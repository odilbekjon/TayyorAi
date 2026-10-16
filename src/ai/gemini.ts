import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
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
   * Javobni JSON schema bo'yicha oladi va zod bilan tekshiradi.
   * Model ba'zan noto'g'ri tuzilma qaytaradi, shuning uchun bir marta qayta urinadi.
   */
  async generateJson<S extends z.ZodType>(
    schema: S,
    prompt: string,
    system: string,
  ): Promise<{ data: z.infer<S>; usage: AiUsage }> {
    // Gemini "$schema" kalitini qabul qilmasligi mumkin, shuning uchun olib tashlaymiz
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema);
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
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
      } catch (err) {
        if (err instanceof ApiError && (err.status === 429 || err.status === 503)) throw new AiBusyError();
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI javobi noto'g'ri formatda");
  }
}
