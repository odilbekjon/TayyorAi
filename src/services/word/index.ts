import { AlignmentType } from "docx";
import { z } from "zod";
import { body, buildDocx, empty, para } from "../../lib/docx.js";
import { safeFilename } from "../../lib/files.js";
import { escapeHtml } from "../../lib/html.js";
import { LANGUAGE_OPTIONS, LANGUAGE_PROMPT, type ServiceDef } from "../types.js";

const DOC_TYPES = [
  { label: "📝 Ariza", value: "ariza" },
  { label: "📋 Tushuntirish xati", value: "tushuntirish xati" },
  { label: "✉️ Rasmiy xat", value: "rasmiy xat" },
  { label: "🤝 Shartnoma", value: "shartnoma" },
  { label: "⭐ Tavsifnoma", value: "tavsifnoma" },
  { label: "📄 Boshqa", value: "boshqa rasmiy hujjat" },
];

const LetterSchema = z.object({
  headerLines: z.array(z.string()).describe("O'ng yuqori burchakdagi 'kimga' va 'kimdan' qatorlari"),
  title: z.string().describe("Hujjat nomi, masalan ARIZA"),
  paragraphs: z.array(z.string().min(1)).min(1),
  signatureLines: z.array(z.string()).describe("Pastdagi sana, F.I.Sh. va imzo qatorlari"),
});

const SYSTEM = `Siz O'zbekistondagi ish yuritish va rasmiy hujjatlar bo'yicha mutaxassissiz.
Foydalanuvchi ma'lumotidan tayyor, rasmiy uslubdagi hujjat yozasiz.
Qoidalar:
- O'zbekistonda qabul qilingan rasmiy hujjat shakliga amal qiling.
- Berilmagan ma'lumot (raqam, sana, summa, pasport) o'rniga "____" qoldiring, o'ylab topmang.
- Shartnoma bo'lsa: bandlarni raqamlab, tomonlarning majburiyatlari, muddat va nizolarni hal qilish bo'limlarini yozing.
- Ortiqcha so'z va takrorlarsiz, aniq va qisqa yozing.`;

export const wordService: ServiceDef = {
  id: "word",
  title: "📝 Word hujjat",
  cost: 5,
  enabled: true,
  eta: "15-30 soniya",
  steps: [
    { key: "docType", kind: "choice", question: "📄 Qanday hujjat kerak?", options: DOC_TYPES, columns: 2 },
    {
      key: "from",
      kind: "text",
      question: "👤 Kimdan? F.I.Sh., lavozim yoki tashkilot.\n\nMasalan: <i>Aliyev Vali, 3-kurs talabasi, 302-guruh</i>",
      minLength: 3,
      maxLength: 300,
    },
    {
      key: "to",
      kind: "text",
      question: "🏛 Kimga? Lavozim va F.I.Sh. yoki tashkilot.\n\nMasalan: <i>TATU rektori A. Karimovga</i>",
      minLength: 3,
      maxLength: 300,
    },
    {
      key: "content",
      kind: "text",
      question:
        "📝 Hujjat mazmunini erkin yozing: nima so'ralyapti yoki nima haqida, sabablari, sanalar, summalar.\n\n" +
        "Masalan: <i>Oilaviy sharoit sababli 1-15 noyabr kunlari darsga kela olmasligim uchun ruxsat so'rayman</i>",
      minLength: 10,
      maxLength: 3000,
    },
    { key: "language", kind: "choice", question: "🌐 Hujjat qaysi tilda bo'lsin?", options: LANGUAGE_OPTIONS, columns: 2 },
  ],

  async generate(a, deps) {
    const prompt = `Hujjat turi: ${a.docType}.
Til: ${LANGUAGE_PROMPT[a.language ?? "uz_latn"]}.
Kimdan: ${a.from}
Kimga: ${a.to}
Mazmuni: ${a.content}`;
    const { data, usage } = await deps.gemini.generateJson(LetterSchema, prompt, SYSTEM);

    const file = await buildDocx(data.title, [
      {
        children: [
          ...data.headerLines.map((l) => para(l, { alignment: AlignmentType.LEFT, indent: { left: 5200 } })),
          ...empty(2),
          para(data.title.toUpperCase(), { alignment: AlignmentType.CENTER, bold: true }),
          ...empty(1),
          ...data.paragraphs.map(body),
          ...empty(2),
          ...data.signatureLines.map((l) => para(l)),
        ],
      },
    ]);

    return {
      file,
      filename: `${safeFilename(data.title, "hujjat")}.docx`,
      caption: `✅ Hujjat tayyor: <b>${escapeHtml(data.title)}</b>\n\n"____" bilan belgilangan joylarni o'zingiz to'ldiring.`,
      usage: { ...usage, images: 0 },
    };
  },
};
