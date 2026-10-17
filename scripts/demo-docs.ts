/**
 * API kalitsiz Rezyume, Word va Kurs ishi dizaynini tekshirish.
 * AI o'rniga namunaviy javob qaytaradigan soxta mijoz ishlatiladi.
 * Ishga tushirish: npm run demo:docs  → out/ papkasida fayllar paydo bo'ladi
 */
import { mkdir, writeFile } from "node:fs/promises";
import type { z } from "zod";
import type { GeminiClient } from "../src/ai/gemini.js";
import { courseworkService } from "../src/services/coursework/index.js";
import { resumeService } from "../src/services/resume/index.js";
import type { Answers, ServiceDef } from "../src/services/types.js";
import { wordService } from "../src/services/word/index.js";

const lorem =
  "Bugungi kunda mazkur yo'nalish iqtisodiyotning eng tez rivojlanayotgan sohalaridan biriga aylanmoqda. " +
  "Davlat tomonidan qabul qilingan dasturlar tadbirkorlik uchun qulay muhit yaratishga qaratilgan. " +
  "Shu bilan birga, sohada malakali kadrlar yetishmasligi va moliyalashtirish manbalarining cheklanganligi saqlanib qolmoqda. " +
  "Ushbu muammolarni hal etish uchun tizimli yondashuv va xalqaro tajribani o'rganish muhim ahamiyatga ega.";

const samples: Record<string, unknown> = {
  chapters: {
    title: "O'zbekistonda kichik biznesning rivojlanish istiqbollari",
    chapters: [
      { title: "Kichik biznesning nazariy asoslari", sections: ["Kichik biznes tushunchasi", "Xorijiy tajriba", "Huquqiy asoslar"] },
      { title: "O'zbekistonda kichik biznesning holati", sections: ["Hozirgi holat tahlili", "Asosiy muammolar", "Davlat ko'magi"] },
      { title: "Rivojlantirish yo'nalishlari", sections: ["Moliyalashtirish", "Raqamlashtirish", "Istiqbollar"] },
    ],
  },
  paragraphs: { paragraphs: [lorem, lorem, lorem] },
  conclusion: {
    conclusion: [lorem, lorem],
    references: ["O'zbekiston Respublikasi Konstitutsiyasi. T.: O'zbekiston, 2023.", "Mankiw N.G. Principles of Economics. Cengage, 2020.", "stat.uz: O'zbekiston Respublikasi Statistika agentligi rasmiy sayti"],
  },
  fullName: {
    fullName: "Aliyev Vali Karimovich",
    position: "Frontend dasturchi",
    contacts: ["+998 90 123 45 67", "vali@gmail.com", "Toshkent", "t.me/validev"],
    summary: "React va TypeScript bo'yicha 2 yillik tajribaga ega frontend dasturchi. Tez ishlaydigan va qulay interfeyslar yaratishga ixtisoslashgan.",
    experience: [
      { role: "React dasturchi", company: "Najot Ta'lim", period: "2022 – 2024", achievements: ["O'quv markazi uchun admin panel yaratdim", "Sahifa yuklanish tezligini 2 baravar oshirdim"] },
    ],
    education: [{ degree: "Dasturiy injiniring, bakalavr", institution: "TATU", period: "2020 – 2024" }],
    skills: ["JavaScript", "TypeScript", "React", "Next.js", "Git", "Jamoada ishlash"],
    languages: ["O'zbek (ona tili)", "Rus (B2)", "Ingliz (B1)"],
  },
  headerLines: {
    headerLines: ["TATU rektori", "A. Karimovga", "Dasturiy injiniring fakulteti", "3-kurs talabasi Aliyev Validan"],
    title: "Ariza",
    paragraphs: ["Oilaviy sharoitim sababli 2026-yil 1-15 noyabr kunlari darslarga qatnasha olmasligim uchun ruxsat berishingizni so'rayman.", "O'tkazib yuborilgan mavzularni mustaqil o'zlashtirishga va belgilangan muddatda topshirishga majburiyat olaman."],
    signatureLines: ["Sana: ____", "Imzo: ____  V. Aliyev"],
  },
};

const fakeGemini = {
  async generateJson<S extends z.ZodType>(schema: S) {
    const key = Object.keys((schema as unknown as z.ZodObject).shape).find((k) => k in samples)!;
    return { data: schema.parse(samples[key]), usage: { inputTokens: 0, outputTokens: 0 } };
  },
} as unknown as GeminiClient;

const runs: Array<[ServiceDef, Answers]> = [
  [resumeService, { language: "uz_latn", template: "zamonaviy" }],
  [wordService, { docType: "ariza", language: "uz_latn" }],
  [courseworkService, {
    kind: "kurs", language: "uz_latn", subject: "Iqtisodiyot", topic: "Kichik biznes",
    university: "Toshkent davlat iqtisodiyot universiteti, Moliya fakulteti", student: "Aliyev Vali, MB-21 guruh", teacher: "i.f.n. Karimov A.",
  }],
];

await mkdir("out", { recursive: true });
for (const [service, answers] of runs) {
  const res = await service.generate!(answers, { gemini: fakeGemini, progress: async (t) => console.log(`  ${t}`) });
  await writeFile(`out/demo-${service.id}.docx`, res.file);
  console.log(`out/demo-${service.id}.docx (${Math.round(res.file.length / 1024)} KB)`);
}
