import { safeFilename } from "../../lib/docx.js";
import { escapeHtml } from "../../lib/html.js";
import { LANGUAGE_OPTIONS, type ServiceDef } from "../types.js";
import { writeResume } from "./content.js";
import { RESUME_TEMPLATES, renderResume } from "./render.js";

export const resumeService: ServiceDef = {
  id: "resume",
  title: "📄 Rezyume",
  cost: 5,
  enabled: true,
  eta: "15-30 soniya",
  steps: [
    { key: "fullName", kind: "text", question: "👤 To'liq ismingizni yozing.\n\nMasalan: <i>Aliyev Vali Karimovich</i>", minLength: 3, maxLength: 80 },
    { key: "position", kind: "text", question: "💼 Qaysi lavozimga topshiryapsiz?\n\nMasalan: <i>Frontend dasturchi</i>", minLength: 2, maxLength: 80 },
    {
      key: "contacts",
      kind: "text",
      question: "📞 Aloqa ma'lumotlari: telefon, email, shahar, Telegram yoki LinkedIn.\n\nMasalan: <i>+998 90 123 45 67, vali@gmail.com, Toshkent</i>",
      minLength: 5,
      maxLength: 300,
    },
    {
      key: "experience",
      kind: "text",
      question:
        "🏢 Ish tajribangizni erkin yozing: qayerda, qaysi lavozimda, qachondan qachongacha, nimalar qilgansiz.\n\n" +
        "Masalan: <i>2022-2024 Najot Ta'lim, React dasturchi, admin panel yaratdim, sahifa tezligini 2 baravar oshirdim</i>\n\n" +
        "Tajriba bo'lmasa, o'tkazib yuboring.",
      minLength: 5,
      maxLength: 2500,
      optional: true,
    },
    {
      key: "education",
      kind: "text",
      question: "🎓 Ta'lim: o'quv yurti, yo'nalish, yillar.\n\nMasalan: <i>TATU, Dasturiy injiniring, 2020-2024</i>",
      minLength: 3,
      maxLength: 800,
    },
    {
      key: "skills",
      kind: "text",
      question: "🛠 Ko'nikmalar va tillarni yozing.\n\nMasalan: <i>JavaScript, React, Git, jamoada ishlash; o'zbek (ona tili), rus (B2), ingliz (B1)</i>",
      minLength: 3,
      maxLength: 800,
    },
    { key: "language", kind: "choice", question: "🌐 Rezyume qaysi tilda bo'lsin?", options: LANGUAGE_OPTIONS, columns: 2 },
    {
      key: "template",
      kind: "choice",
      question: "🎨 Dizaynni tanlang:",
      options: RESUME_TEMPLATES.map((t) => ({ label: t.label, value: t.id })),
      columns: 3,
    },
  ],

  async generate(answers, deps) {
    const { data, usage } = await writeResume(deps.gemini, answers);
    const file = await renderResume(data, answers.template, answers.language ?? "uz_latn");
    return {
      file,
      filename: `${safeFilename(data.fullName, "rezyume")} - rezyume.docx`,
      caption: `✅ Rezyume tayyor: <b>${escapeHtml(data.fullName)}</b>\n\nWord faylni o'zingiz tahrirlashingiz yoki PDF qilib saqlashingiz mumkin.`,
      usage: { ...usage, images: 0 },
    };
  },
};
