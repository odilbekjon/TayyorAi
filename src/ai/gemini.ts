import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

const BUSY_RETRY_DELAYS_MS = [10_000, 20_000, 40_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

export class AiBusyError extends Error {
  constructor() {
    super("AI xizmati hozir band (so'rovlar limiti)");
  }
}

export class GeminiClient {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
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
   * Bepul tarifda daqiqalik limit tez tugaydi: 429/503 bo'lsa biroz kutib qayta so'raydi.
   */
  async generateJson<S extends z.ZodType>(
    schema: S,
    prompt: string,
    system: string,
  ): Promise<{ data: z.infer<S>; usage: AiUsage }> {
    // Gemini "$schema" kalitini qabul qilmasligi mumkin, shuning uchun olib tashlaymiz
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema);
    let lastError: unknown;
    let parseFailures = 0;
    let busyRetries = 0;

    while (parseFailures < 2) {
      try {
        const res = await this.ai.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
            temperature: 0.7,
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
        if (err instanceof ApiError && (err.status === 429 || err.status === 503)) {
          if (busyRetries >= BUSY_RETRY_DELAYS_MS.length) throw new AiBusyError();
          await sleep(BUSY_RETRY_DELAYS_MS[busyRetries++]!);
          continue;
        }
        lastError = err;
        parseFailures++;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI javobi noto'g'ri formatda");
  }
}
