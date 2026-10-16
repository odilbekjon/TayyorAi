import { z } from "zod";
import type { GeminiClient } from "../../ai/gemini.js";
import { LANGUAGE_PROMPT, type Answers } from "../types.js";

export const ResumeSchema = z.object({
  fullName: z.string().min(1),
  position: z.string().min(1),
  contacts: z.array(z.string()).describe("Telefon, email, shahar, havolalar: har biri alohida"),
  summary: z.string().describe("2-3 gaplik professional profil"),
  experience: z.array(
    z.object({
      role: z.string(),
      company: z.string(),
      period: z.string().describe("Masalan: 2022 – hozirgacha"),
      achievements: z.array(z.string()).max(5),
    }),
  ),
  education: z.array(z.object({ degree: z.string(), institution: z.string(), period: z.string() })),
  skills: z.array(z.string()).max(15),
  languages: z.array(z.string()).describe("Masalan: Ingliz tili (B2)"),
});

export type Resume = z.infer<typeof ResumeSchema>;

const SYSTEM = `Siz HR mutaxassisi va rezyume yozish bo'yicha ekspertsiz.
Foydalanuvchi bergan xom ma'lumotni professional rezyumega aylantirasiz.
Qoidalar:
- Faqat berilgan faktlardan foydalaning. Yangi ish joyi, sana, diplom yoki raqam o'ylab topmang.
- Vazifalarni natijaga yo'naltirilgan, faol fe'llar bilan qisqa yozing.
- Ma'lumot berilmagan bo'lim uchun bo'sh massiv qaytaring.
- Imlo va uslubni tuzating, lekin ismlar va kompaniya nomlarini o'zgartirmang.`;

export async function writeResume(gemini: GeminiClient, a: Answers) {
  const prompt = `Rezyume tili: ${LANGUAGE_PROMPT[a.language ?? "uz_latn"]}.

F.I.Sh.: ${a.fullName}
Lavozim / maqsad: ${a.position}
Aloqa: ${a.contacts}
Ish tajribasi: ${a.experience ?? "yo'q"}
Ta'lim: ${a.education}
Ko'nikmalar va tillar: ${a.skills}`;

  return gemini.generateJson(ResumeSchema, prompt, SYSTEM);
}
