/**
 * API kalitsiz barcha hujjat va dizayn xizmatlarini tekshirish.
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
import { cardService } from "../src/services/card/index.js";
import { excelService } from "../src/services/excel/index.js";
import { flyerService } from "../src/services/flyer/index.js";
import { inviteService } from "../src/services/invite/index.js";
import { closeBrowser } from "../src/lib/html-render.js";

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

Object.assign(samples, {
  card: {
    fullName: "Vali Aliyev", position: "Bosh dizayner", company: "Kreativ Studio",
    contacts: [{ type: "phone", value: "+998 90 123 45 67" }, { type: "email", value: "vali@gmail.com" }, { type: "telegram", value: "@validesign" }],
  },
  invite: {
    heading: "Taklifnoma", names: "Jasur va Madina",
    invitation: "Hayotimizning eng baxtli kunida farzandlarimizning nikoh to'yida aziz mehmonimiz bo'lishingizni so'rab qolamiz.",
    date: "15-noyabr, shanba", time: "Soat 18:00", place: "\"Navro'z\" to'yxonasi, Toshkent", closing: "Hurmat bilan, Aliyevlar oilasi",
  },
  flyer: {
    headline: "IELTS 7+ ga 3 oyda tayyorlaning", subheadline: "Tajribali ustozlar va kichik guruhlarda samarali darslar.",
    bullets: ["Haftasiga 3 marta dars", "Bepul sinov imtihoni", "Sertifikatli o'qituvchilar"],
    offer: "Birinchi oy 30% chegirma", cta: "Hoziroq yoziling!", imageQuery: "students classroom",
  },
  budget: {
    title: "Oilaviy byudjet: noyabr", incomes: [{ name: "Maosh", amount: 6000000 }, { name: "Qo'shimcha ish", amount: 1500000 }],
    expenses: [{ category: "Uy", name: "Ijara", amount: 2000000 }, { category: "Oziq-ovqat", name: "Bozor va do'kon", amount: 1800000 }, { category: "Transport", name: "Yoqilg'i", amount: 600000 }],
  },
  business: {
    title: "Kofe shop: 12 oylik prognoz", startupCosts: [{ name: "Kofe mashinasi", amount: 45000000 }, { name: "Ta'mirlash", amount: 25000000 }],
    revenues: [{ name: "Kofe sotuvi", monthlyAmount: 60000000 }, { name: "Shirinliklar", monthlyAmount: 15000000 }],
    monthlyCosts: [{ name: "Ijara", amount: 12000000 }, { name: "Ish haqi", amount: 18000000 }, { name: "Xomashyo", amount: 25000000 }],
    monthlyGrowthPercent: 4,
  },
  loan: { title: "Kredit: 50 mln so'm, 24 oy", principal: 50000000, annualRatePercent: 24, months: 24, method: "annuitet" },
});

// Sxemaning maydonlari bilan to'liq mos keladigan namunani tanlaymiz
const fakeGemini = {
  async generateJson<S extends z.ZodType>(schema: S) {
    const keys = Object.keys((schema as unknown as z.ZodObject).shape).sort().join(",");
    const sample = Object.values(samples).find((v) => Object.keys(v as object).sort().join(",") === keys);
    if (!sample) throw new Error(`Namuna topilmadi: ${keys}`);
    return { data: schema.parse(sample), usage: { inputTokens: 0, outputTokens: 0 } };
  },
} as unknown as GeminiClient;

const runs: Array<[ServiceDef, Answers]> = [
  [resumeService, { language: "uz_latn", template: "zamonaviy" }],
  [wordService, { docType: "ariza", language: "uz_latn" }],
  [courseworkService, {
    kind: "kurs", language: "uz_latn", subject: "Iqtisodiyot", topic: "Kichik biznes",
    university: "Toshkent davlat iqtisodiyot universiteti, Moliya fakulteti", student: "Aliyev Vali, MB-21 guruh", teacher: "i.f.n. Karimov A.",
  }],
  [cardService, { template: "oltin" }],
  [inviteService, { style: "milliy" }],
  [flyerService, { format: "post", style: "premium", photo: "no", contacts: "+998 90 123 45 67 • @english_center" }],
  [excelService, { kind: "byudjet", currency: "UZS" }],
  [excelService, { kind: "biznes", currency: "UZS" }],
  [excelService, { kind: "kredit", currency: "UZS" }],
];

await mkdir("out", { recursive: true });
for (const [service, answers] of runs) {
  const res = await service.generate!(answers, { gemini: fakeGemini, progress: async (t) => console.log(`  ${t}`) });
  const ext = res.filename.split(".").pop();
  const name = `out/demo-${service.id}${answers.kind ? `-${answers.kind}` : ""}`;
  await writeFile(`${name}.${ext}`, res.file);
  if (res.preview) await writeFile(`${name}.png`, res.preview);
  console.log(`${name}.${ext} (${Math.round(res.file.length / 1024)} KB)`);
}
await closeBrowser();
