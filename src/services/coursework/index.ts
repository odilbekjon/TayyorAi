import { AlignmentType, Paragraph } from "docx";
import { body, buildDocx, empty, heading, pageNumberFooter, para } from "../../lib/docx.js";
import { safeFilename } from "../../lib/files.js";
import { escapeHtml } from "../../lib/html.js";
import { LANGUAGE_OPTIONS, type ServiceDef } from "../types.js";
import { WORK_KINDS, workKind, writeCoursework, type CourseworkText, type WorkKind } from "./content.js";

const LABELS: Record<string, { plan: string; intro: string; conclusion: string; references: string; topic: string; done: string; checked: string; chapter: string }> = {
  uz_latn: { plan: "Reja", intro: "Kirish", conclusion: "Xulosa", references: "Foydalanilgan adabiyotlar", topic: "Mavzu", done: "Bajardi", checked: "Qabul qildi", chapter: "bob" },
  uz_cyrl: { plan: "Режа", intro: "Кириш", conclusion: "Хулоса", references: "Фойдаланилган адабиётлар", topic: "Мавзу", done: "Бажарди", checked: "Қабул қилди", chapter: "боб" },
  ru: { plan: "Содержание", intro: "Введение", conclusion: "Заключение", references: "Список литературы", topic: "Тема", done: "Выполнил(а)", checked: "Проверил(а)", chapter: "глава" },
  en: { plan: "Contents", intro: "Introduction", conclusion: "Conclusion", references: "References", topic: "Topic", done: "Student", checked: "Supervisor", chapter: "chapter" },
};

const ROMAN = ["I", "II", "III", "IV", "V"];

function render(w: CourseworkText, kind: WorkKind, a: Record<string, string>) {
  const L = LABELS[a.language ?? "uz_latn"] ?? LABELS.uz_latn!;
  const chapterTitle = (i: number, title: string) => `${ROMAN[i]} ${L.chapter.toUpperCase()}. ${title}`;
  const right = (text: string, bold = false) => para(text, { alignment: AlignmentType.LEFT, indent: { left: 5000 }, bold });

  const titlePage: Paragraph[] = [
    ...a.university!.split(/[,\n]/).map((l) => para(l.trim().toUpperCase(), { alignment: AlignmentType.CENTER, bold: true })),
    ...empty(5),
    para(kind.titleWord, { alignment: AlignmentType.CENTER, bold: true, size: 40 }),
    ...empty(1),
    para(`${L.topic}: ${w.title}`, { alignment: AlignmentType.CENTER, bold: true, size: 32 }),
    ...empty(5),
    right(`${L.done}:`, true),
    right(a.student!),
    ...(a.teacher ? [...empty(1), right(`${L.checked}:`, true), right(a.teacher)] : []),
    ...empty(4),
    para(String(new Date().getFullYear()), { alignment: AlignmentType.CENTER, pageBreakBefore: false }),
  ];

  const plan: Paragraph[] = [
    heading(L.plan, 1, true),
    para(L.intro),
    ...w.chapters.flatMap((c, i) => [
      para(chapterTitle(i, c.title), { bold: true }),
      ...c.sections.map((s) => para(s.title, { indent: { left: 400 } })),
    ]),
    para(L.conclusion),
    para(L.references),
  ];

  const main: Paragraph[] = [
    heading(L.intro, 1, true),
    ...w.intro.map(body),
    ...w.chapters.flatMap((c, i) => [
      heading(chapterTitle(i, c.title), 1, true),
      ...c.sections.flatMap((s) => [heading(s.title, 2), ...s.paragraphs.map(body)]),
    ]),
    heading(L.conclusion, 1, true),
    ...w.conclusion.map(body),
    heading(L.references, 1, true),
    ...w.references.map((r, i) => para(`${i + 1}. ${r}`, { alignment: AlignmentType.JUSTIFIED })),
  ];

  return buildDocx(w.title, [{ titlePage: true, footers: { default: pageNumberFooter() }, children: [...titlePage, ...plan, ...main] }]);
}

export const courseworkService: ServiceDef = {
  id: "coursework",
  title: "🎓 Kurs ishi / mustaqil ish",
  cost: Math.min(...WORK_KINDS.map((k) => k.cost)),
  costFor: (a) => workKind(a.kind).cost,
  enabled: true,
  eta: "1-4 daqiqa",
  steps: [
    {
      key: "kind",
      kind: "choice",
      question: `📚 Ish turini tanlang:\n\n${WORK_KINDS.map((k) => `${k.label}: ${k.cost} kredit`).join("\n")}`,
      options: WORK_KINDS.map((k) => ({ label: k.label, value: k.value })),
    },
    { key: "subject", kind: "text", question: "📖 Fan nomini yozing.\n\nMasalan: <i>Iqtisodiyot nazariyasi</i>", minLength: 2, maxLength: 120 },
    {
      key: "topic",
      kind: "text",
      question: "📝 Mavzuni yozing.\n\nMasalan: <i>O'zbekistonda kichik biznesning rivojlanish istiqbollari</i>",
      minLength: 5,
      maxLength: 250,
    },
    {
      key: "university",
      kind: "text",
      question: "🏛 O'quv yurti va fakultet (titul varag'i uchun), vergul bilan.\n\nMasalan: <i>Toshkent davlat iqtisodiyot universiteti, Moliya fakulteti</i>",
      minLength: 3,
      maxLength: 250,
    },
    {
      key: "student",
      kind: "text",
      question: "👤 Talabaning F.I.Sh. va guruhi.\n\nMasalan: <i>Aliyev Vali, MB-21 guruh</i>",
      minLength: 3,
      maxLength: 120,
    },
    {
      key: "teacher",
      kind: "text",
      question: "👨‍🏫 O'qituvchining F.I.Sh. (ixtiyoriy).",
      maxLength: 120,
      optional: true,
    },
    { key: "language", kind: "choice", question: "🌐 Ish qaysi tilda yozilsin?", options: LANGUAGE_OPTIONS, columns: 2 },
  ],

  async generate(answers, deps) {
    const kind = workKind(answers.kind);
    const text = await writeCoursework(deps.gemini, answers, deps.progress);
    const file = await render(text, kind, answers);
    return {
      file,
      filename: `${safeFilename(text.title, "ish")}.docx`,
      caption:
        `✅ ${kind.titleWord.toLowerCase()} tayyor: <b>${escapeHtml(text.title)}</b>\n\n` +
        `⚠️ Bu namuna va qoralama. Topshirishdan oldin o'qib chiqing, faktlar va adabiyotlarni tekshiring, o'z fikrlaringizni qo'shing.`,
      usage: { ...text.usage, images: 0 },
    };
  },
};
