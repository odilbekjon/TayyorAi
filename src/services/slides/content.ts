import { z } from "zod";
import type { GeminiClient } from "../../ai/gemini.js";
import { LANGUAGE_PROMPT, type Answers } from "../types.js";

export const DeckSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string(),
  slides: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(2).max(6),
        imageQuery: z.string().describe("Rasm qidirish uchun 2-4 so'zli inglizcha ibora"),
      }),
    )
    .min(3),
  conclusion: z.string().describe("Yakuniy slayd uchun 1-2 gaplik xulosa"),
});

export type Deck = z.infer<typeof DeckSchema>;

const AUDIENCE: Record<string, string> = {
  maktab: "maktab o'quvchilari uchun, sodda va tushunarli",
  talaba: "oliy ta'lim talabalari uchun, ilmiy va aniq",
  ish: "ish taqdimoti uchun, qisqa, raqamlar va amaliy xulosalar bilan",
};

const SYSTEM = `Siz tajribali taqdimot mutaxassisisiz. Faktlarga asoslangan, aniq va mazmunli slayd matnlarini yozasiz.
Qoidalar:
- Har bir punkt 6-16 so'zdan iborat, to'liq fikr bo'lsin, takrorlanmasin.
- Slaydlar mantiqiy ketma-ketlikda: kirish, asosiy qism, xulosa.
- Uydirma statistika yoki manba keltirmang; aniq bo'lmagan raqam yozmang.
- imageQuery har doim ingliz tilida bo'lsin.`;

export async function writeDeck(gemini: GeminiClient, answers: Answers) {
  const total = Number(answers.count ?? 10);
  // Titul va yakuniy slayd alohida chiziladi
  const contentSlides = Math.max(3, total - 2);
  const prompt = `Mavzu: "${answers.topic}".
Til: ${LANGUAGE_PROMPT[answers.language ?? "uz_latn"]}.
Auditoriya: ${AUDIENCE[answers.audience ?? "talaba"]}.
Aynan ${contentSlides} ta mazmunli slayd yozing (titul va yakuniy slayddan tashqari), har birida 3-5 ta punkt.`;

  return gemini.generateJson(DeckSchema, prompt, SYSTEM);
}
