import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Barcha modellar band bo'lsa, foydalanuvchini jami shuncha vaqtdan ortiq kutdirmaymiz */
const MAX_TOTAL_WAIT_MS = 90_000;
/** Bitta so'rov uchun limit/band xatolari soni chegarasi (kvotani behuda yoqmaslik uchun) */
const MAX_BUSY_ERRORS = 6;

export function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

export class AiBusyError extends Error {
  constructor() {
    super("AI xizmati hozir band (so'rovlar limiti)");
  }
}

export interface JsonOptions {
  /** Rasm yoki PDF (masalan, to'lov cheki) bilan birga so'rash */
  file?: { data: Buffer; mimeType: string };
  temperature?: number;
}

/** Gemini xatosidan limit turini va qancha kutish kerakligini ajratib oladi */
function describeLimit(err: ApiError) {
  const daily = /PerDay/i.test(err.message);
  const delay = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(err.message)?.[1];
  const quotaId = /"quotaId":\s*"([^"]+)"/.exec(err.message)?.[1];
  return { daily, retryMs: delay ? Math.ceil(Number(delay) * 1000) : undefined, quotaId };
}

export class GeminiClient {
  private readonly ai: GoogleGenAI;
  /** Asosiy model birinchi, keyin zaxira modellar (bepul tarifda har birining limiti alohida) */
  private models: string[];
  /** Limiti tugagan model shu vaqtgacha ishlatilmaydi */
  private readonly cooldownUntil = new Map<string, number>();
  /** Admin /ai buyrug'i uchun: har bir modelning oxirgi xatosi */
  private readonly lastError = new Map<string, { at: Date; text: string }>();

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly fallbackModels: string[] = [],
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.models = [model, ...fallbackModels.filter((m) => m !== model)];
  }

  get activeModels() {
    return [...this.models];
  }

  /** Modellar holati: qaysi biri dam olyapti va oxirgi xatosi (so'rov yubormaydi) */
  status() {
    const now = Date.now();
    return this.models.map((model) => {
      const until = this.cooldownUntil.get(model) ?? 0;
      return { model, restingSec: until > now ? Math.ceil((until - now) / 1000) : 0, lastError: this.lastError.get(model) };
    });
  }

  /**
   * GEMINI_FALLBACK_MODELS berilmagan bo'lsa, kalitga ochiq "flash" modellardan
   * eng yangi ikkitasini zaxira qilib oladi. Berilganlardan mavjud bo'lmaganlari olib tashlanadi.
   */
  async resolveFallbacks(): Promise<void> {
    let available: string[];
    try {
      available = [];
      for await (const m of await this.ai.models.list({ config: { pageSize: 100 } })) {
        if (m.name && m.supportedActions?.includes("generateContent")) available.push(m.name.replace(/^models\//, ""));
      }
    } catch (err) {
      console.warn("⚠️ Gemini modellar ro'yxati olinmadi:", err instanceof Error ? err.message : err);
      return;
    }
    const version = (name: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1] ?? 0);
    const fallbacks = this.fallbackModels.length
      ? this.fallbackModels.filter((m) => available.includes(m))
      : available
          // Faqat barqaror matn modellari: preview, image, tts, live va hokazolarsiz
          .filter((m) => /^gemini-\d+(\.\d+)?-flash(-lite)?$/.test(m) && m !== this.model)
          .sort((a, b) => version(b) - version(a) || a.length - b.length)
          .slice(0, 2);
    this.models = [this.model, ...fallbacks.filter((m) => m !== this.model)];
  }

  /**
   * Ishga tushganda model mavjudligini tekshiradi. Google eski modellarni yangi
   * foydalanuvchilar uchun o'chirib qo'yadi (404), bu holda bot ishlamaydi.
   */
  async checkModel(): Promise<void> {
    try {
      await this.ai.models.generateContent({ model: this.model, contents: "ping", config: { maxOutputTokens: 8 } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new Error(
          `Gemini modeli "${this.model}" mavjud emas yoki o'chirilgan. .env faylidagi GEMINI_MODEL qiymatini ` +
            `yangilang (masalan: gemini-3.8-flash). Google xabari: ${err.message}`,
        );
      }
      if (err instanceof ApiError && [400, 401, 403].includes(err.status)) {
        throw new Error(`GEMINI_API_KEY noto'g'ri yoki ruxsat yo'q. Google xabari: ${err.message}`);
      }
      // Tarmoq yoki limit xatosi botni to'xtatmasligi kerak
      console.warn("⚠️ Gemini tekshiruvi o'tmadi:", err instanceof Error ? err.message : err);
    }
  }

  /**
   * Javobni JSON schema bo'yicha oladi va zod bilan tekshiradi.
   * Model ba'zan noto'g'ri tuzilma qaytaradi, shuning uchun bir marta qayta urinadi.
   * Bepul tarifda limit tez tugaydi: 429/503 bo'lsa darhol zaxira modelga o'tadi,
   * hammasi band bo'lsa biroz kutib qayta so'raydi.
   */
  async generateJson<S extends z.ZodType>(
    schema: S,
    prompt: string,
    system: string,
    options: JsonOptions = {},
  ): Promise<{ data: z.infer<S>; usage: AiUsage }> {
    // Gemini "$schema" kalitini qabul qilmasligi mumkin, shuning uchun olib tashlaymiz
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema);
    let lastError: unknown;
    let parseFailures = 0;
    let waited = 0;
    let busyErrors = 0;
    const contents = options.file
      ? [{ role: "user", parts: [{ inlineData: { data: options.file.data.toString("base64"), mimeType: options.file.mimeType } }, { text: prompt }] }]
      : prompt;

    while (parseFailures < 2) {
      const now = Date.now();
      const model = this.models.find((m) => (this.cooldownUntil.get(m) ?? 0) <= now);
      if (!model) {
        // Hamma model band: eng tez bo'shaydiganini kutamiz, juda uzoq bo'lsa voz kechamiz
        const soonest = Math.min(...this.models.map((m) => this.cooldownUntil.get(m) ?? now)) - now;
        if (waited + soonest > MAX_TOTAL_WAIT_MS) throw new AiBusyError();
        await sleep(soonest);
        waited += soonest;
        continue;
      }
      try {
        const res = await this.ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
            temperature: options.temperature ?? 0.7,
          },
        });
        const usage: AiUsage = {
          inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
          outputTokens:
            (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
        };
        const parsed = schema.safeParse(JSON.parse(res.text ?? ""));
        if (parsed.success) return { data: parsed.data, usage };
        lastError = parsed.error;
        parseFailures++;
      } catch (err) {
        if (err instanceof ApiError && [429, 500, 503, 504].includes(err.status)) {
          const limit = describeLimit(err);
          // Kunlik limit tugasa model bir soat chetga qo'yiladi, daqiqalik limitda Google aytgan vaqtcha
          const cooldown = limit.daily ? 60 * 60_000 : Math.max(5_000, limit.retryMs ?? (err.status === 429 ? 30_000 : 15_000));
          this.cooldownUntil.set(model, Date.now() + cooldown);
          this.lastError.set(model, {
            at: new Date(),
            text: `HTTP ${err.status}${limit.daily ? ", kunlik limit tugadi" : err.status === 429 ? ", daqiqalik limit" : ", Google serveri band"}`,
          });
          console.warn(
            `[gemini] ${model}: HTTP ${err.status}${limit.quotaId ? ` (${limit.quotaId})` : ""}, ` +
              `${Math.round(cooldown / 1000)} s dam oladi. ${err.message.slice(0, 300)}`,
          );
          if (++busyErrors >= MAX_BUSY_ERRORS) throw new AiBusyError();
          continue;
        }
        if (err instanceof ApiError && err.status === 404 && model !== this.model) {
          // Zaxira model o'chirilgan bo'lsa, undan butunlay voz kechamiz
          console.warn(`[gemini] zaxira model ${model} topilmadi, ro'yxatdan olib tashlandi`);
          this.models = this.models.filter((m) => m !== model);
          continue;
        }
        console.warn(`[gemini] ${model}: ${err instanceof Error ? err.message.slice(0, 300) : err}`);
        lastError = err;
        parseFailures++;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI javobi noto'g'ri formatda");
  }
}
