import { z } from "zod";
import { addUsage, type AiUsage, type GeminiClient } from "../../ai/gemini.js";
import { LANGUAGE_PROMPT, type Answers } from "../types.js";

export interface WorkKind {
  value: string;
  label: string;
  /** Titul varag'idagi nomi */
  titleWord: string;
  cost: number;
  chapters: number;
  sectionsPerChapter: number;
  wordsPerSection: number;
}

export const WORK_KINDS: WorkKind[] = [
  { value: "mustaqil", label: "📘 Mustaqil ish (10-12 bet)", titleWord: "MUSTAQIL ISH", cost: 15, chapters: 2, sectionsPerChapter: 2, wordsPerSection: 450 },
  { value: "referat", label: "📗 Referat (15-18 bet)", titleWord: "REFERAT", cost: 20, chapters: 2, sectionsPerChapter: 3, wordsPerSection: 500 },
  { value: "kurs", label: "📕 Kurs ishi (25-30 bet)", titleWord: "KURS ISHI", cost: 25, chapters: 3, sectionsPerChapter: 3, wordsPerSection: 650 },
];

export function workKind(value: string | undefined) {
  return WORK_KINDS.find((k) => k.value === value) ?? WORK_KINDS[0]!;
}

const OutlineSchema = z.object({
  title: z.string().describe("Mavzuning aniq, tahrirlangan nomi"),
  chapters: z.array(z.object({ title: z.string(), sections: z.array(z.string()) })),
});

const ParagraphsSchema = z.object({ paragraphs: z.array(z.string().min(1)).min(1) });

const EndingSchema = z.object({
  conclusion: z.array(z.string().min(1)).min(1),
  references: z.array(z.string()).describe("Foydalanilgan adabiyotlar ro'yxati"),
});

export interface CourseworkText {
  title: string;
  intro: string[];
  chapters: Array<{ title: string; sections: Array<{ title: string; paragraphs: string[] }> }>;
  conclusion: string[];
  references: string[];
  usage: AiUsage;
}

const SYSTEM = `Siz oliy ta'lim bo'yicha tajribali ilmiy rahbarsiz va akademik matnlar yozasiz.
Qoidalar:
- Ilmiy-ommabop, rasmiy uslubda, mantiqiy bog'langan xatboshilarda yozing.
- Har bir xatboshi 4-7 gapdan iborat bo'lsin. Ro'yxat va sarlavha qo'shmang, faqat xatboshilar.
- Aniq bo'lmagan statistika, sana yoki iqtibos o'ylab topmang. Umumiy qabul qilingan bilimlarga tayaning.
- Oldingi bo'limlarda aytilgan fikrlarni takrorlamang.`;

/**
 * Uzun matnni bir so'rovda yozdirib bo'lmaydi (model qisqartirib yuboradi),
 * shuning uchun avval reja, keyin har bir bo'lim alohida yoziladi.
 */
export async function writeCoursework(
  gemini: GeminiClient,
  a: Answers,
  progress?: (text: string) => Promise<void>,
): Promise<CourseworkText> {
  const kind = workKind(a.kind);
  const lang = LANGUAGE_PROMPT[a.language ?? "uz_latn"];
  const context = `Fan: ${a.subject}. Mavzu: "${a.topic}". Ish turi: ${kind.titleWord.toLowerCase()}. Til: ${lang}.`;

  await progress?.("📑 Reja tuzilmoqda...");
  const outline = await gemini.generateJson(
    OutlineSchema,
    `${context}\nAynan ${kind.chapters} ta bob, har bir bobda aynan ${kind.sectionsPerChapter} ta paragraf bo'lgan reja tuzing. Bob nomlarini "I BOB." kabi raqamsiz yozing.`,
    SYSTEM,
  );
  let usage = outline.usage;
  const plan = outline.data.chapters
    .map((c, i) => `${i + 1}-bob: ${c.title}\n${c.sections.map((s, j) => `  ${i + 1}.${j + 1}. ${s}`).join("\n")}`)
    .join("\n");

  const totalSteps = outline.data.chapters.reduce((n, c) => n + c.sections.length, 0) + 2;
  let step = 0;
  const write = async (task: string, words: number) => {
    step++;
    await progress?.(`✍️ Yozilmoqda: ${step}/${totalSteps}`);
    const res = await gemini.generateJson(
      ParagraphsSchema,
      `${context}\nIshning rejasi:\n${plan}\n\nVazifa: ${task}. Hajmi taxminan ${words} so'z.`,
      SYSTEM,
    );
    usage = addUsage(usage, res.usage);
    return res.data.paragraphs;
  };

  const intro = await write(
    "KIRISH qismini yozing: mavzuning dolzarbligi, ishning maqsadi va vazifalari, o'rganish obyekti va predmeti, ish tuzilishi",
    Math.round(kind.wordsPerSection * 0.9),
  );

  // Bepul tarif limitlari uchun bo'limlar ketma-ket yoziladi
  const chapters: CourseworkText["chapters"] = [];
  for (const [i, c] of outline.data.chapters.entries()) {
    const sections = [];
    for (const [j, s] of c.sections.entries()) {
      const paragraphs = await write(`${i + 1}-bobning ${i + 1}.${j + 1}-paragrafini yozing: "${s}"`, kind.wordsPerSection);
      sections.push({ title: `${i + 1}.${j + 1}. ${s}`, paragraphs });
    }
    chapters.push({ title: c.title, sections });
  }

  step++;
  await progress?.(`✍️ Yozilmoqda: ${step}/${totalSteps}`);
  const ending = await gemini.generateJson(
    EndingSchema,
    `${context}\nIshning rejasi:\n${plan}\n\nVazifa: XULOSA qismini (taxminan ${Math.round(kind.wordsPerSection * 0.8)} so'z) va 8-12 ta foydalanilgan adabiyotlar ro'yxatini yozing. ` +
      `Adabiyotlar ro'yxatiga faqat haqiqatan mavjud, mashhur darsliklar, qonunlar va rasmiy saytlarni kiriting.`,
    SYSTEM,
  );
  usage = addUsage(usage, ending.usage);

  return { title: outline.data.title, intro, chapters, conclusion: ending.data.conclusion, references: ending.data.references, usage };
}
