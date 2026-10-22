import { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, WidthType, convertMillimetersToTwip as mm } from "docx";
import { z } from "zod";
import { buildDocx, para } from "../../lib/docx.js";
import { safeFilename } from "../../lib/files.js";
import { escapeHtml } from "../../lib/html.js";
import { LANGUAGE_OPTIONS, LANGUAGE_PROMPT, type ServiceDef } from "../types.js";

const COUNTS = [
  { value: "10", cost: 4 },
  { value: "20", cost: 6 },
  { value: "30", cost: 8 },
  { value: "50", cost: 10 },
];
const countOf = (v: string | undefined) => COUNTS.find((c) => c.value === v) ?? COUNTS[0]!;

const LEVELS = [
  { label: "🧒 1-4 sinf", value: "boshlang'ich sinf (1-4 sinf) o'quvchilari" },
  { label: "📘 5-9 sinf", value: "maktabning 5-9 sinf o'quvchilari" },
  { label: "📗 10-11 sinf / litsey", value: "10-11 sinf, akademik litsey va kollej o'quvchilari" },
  { label: "🎓 Talabalar (OTM)", value: "oliy ta'lim talabalari" },
  { label: "💼 Kattalar / malaka", value: "kattalar, mutaxassislar va malaka oshirish tinglovchilari" },
  { label: "🏆 Abituriyent (DTM)", value: "oliy ta'limga kiruvchi abituriyentlar, DTM test uslubida" },
];

const DIFFICULTY = [
  { label: "🟢 Oson", value: "oson" },
  { label: "🟡 O'rta", value: "o'rta" },
  { label: "🔴 Qiyin", value: "qiyin" },
  { label: "🎯 Aralash", value: "aralash: oson, o'rta va qiyin savollar teng taqsimlangan" },
];

const QuizSchema = z.object({
  title: z.string().describe("Test nomi: fan va mavzu, masalan: Biologiya. Hujayra tuzilishi"),
  questions: z
    .array(
      z.object({
        question: z.string().min(3),
        options: z.array(z.string().min(1)).length(4).describe("To'rtta javob varianti, harf (A, B...) qo'shmasdan"),
        correct: z.number().int().min(0).max(3).describe("To'g'ri javob indeksi: 0-3"),
      }),
    )
    .min(1),
});
type Question = z.infer<typeof QuizSchema>["questions"][number];

const SYSTEM = `Siz tajribali pedagog va test tuzuvchisiz. Ta'lim muassasalari uchun sifatli test savollari tuzasiz.
Qoidalar:
- Har bir savolda aniq bitta to'g'ri javob bo'lsin, qolgan uchtasi ishonarli, lekin aniq noto'g'ri bo'lsin.
- Savollar faktlarga mos, bir-birini takrorlamaydigan va mavzuni to'liq qamrab olgan bo'lsin.
- "Hammasi to'g'ri" yoki "To'g'ri javob yo'q" kabi variantlarni ishlatmang.
- Javob variantlari uzunligi taxminan bir xil bo'lsin, to'g'ri javob uzunligi bilan ajralib turmasin.
- Savol va variantlar oldiga raqam yoki harf qo'ymang.
- Formulalarni oddiy matnda yozing, masalan: x^2 + 3x = 0, H2O.`;

const LETTERS = ["A", "B", "C", "D"];

const LABELS: Record<string, { variant: string; name: string; group: string; date: string; key: string; question: string; answer: string }> = {
  uz_latn: { variant: "variant", name: "F.I.Sh.", group: "Sinf / guruh", date: "Sana", key: "Javoblar kaliti", question: "Savol", answer: "Javob" },
  uz_cyrl: { variant: "вариант", name: "Ф.И.Ш.", group: "Синф / гуруҳ", date: "Сана", key: "Жавоблар калити", question: "Савол", answer: "Жавоб" },
  ru: { variant: "вариант", name: "Ф.И.О.", group: "Класс / группа", date: "Дата", key: "Ключ ответов", question: "Вопрос", answer: "Ответ" },
  en: { variant: "variant", name: "Name", group: "Class / group", date: "Date", key: "Answer key", question: "Question", answer: "Answer" },
};

/** Takrorlanadigan aralashtirish: bir xil test uchun natija har doim bir xil bo'ladi */
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function shuffle<T>(items: T[], rnd: () => number) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Variant: savollar tartibi (1-variantdan tashqari) va javob variantlari aralashtiriladi.
 * AI to'g'ri javobni ko'pincha A ga qo'yadi, shuning uchun 1-variantda ham javoblar aralashtiriladi.
 */
function makeVariant(questions: Question[], index: number): Question[] {
  const rnd = seededRandom(index * 7919 + questions.length);
  const ordered = index === 0 ? questions : shuffle(questions, rnd);
  return ordered.map((q) => {
    const order = shuffle([0, 1, 2, 3], rnd);
    return { question: q.question, options: order.map((i) => q.options[i]!), correct: order.indexOf(q.correct) };
  });
}

const SMALL = 24; // 12 pt: test varaqlari ixcham bo'ladi
const line = (text: string, opts: Parameters<typeof para>[1] = {}) => para(text, { size: SMALL, spacing: { line: 276, after: 0 }, ...opts });

function variantPages(title: string, questions: Question[], label: string | null, L: (typeof LABELS)[string], first: boolean): Paragraph[] {
  return [
    line(title, { alignment: AlignmentType.CENTER, bold: true, size: 28, pageBreakBefore: !first }),
    ...(label ? [line(label, { alignment: AlignmentType.CENTER, bold: true })] : []),
    line(""),
    line(`${L.name}: ______________________________   ${L.group}: __________   ${L.date}: ________`),
    line(""),
    ...questions.flatMap((q, i) => [
      line(`${i + 1}. ${q.question}`, { bold: true, spacing: { line: 276, before: 160, after: 40 }, keepNext: true }),
      ...q.options.map((o, j) =>
        line(`${LETTERS[j]}) ${o}`, { indent: { left: mm(6) }, keepNext: j < q.options.length - 1, keepLines: true }),
      ),
    ]),
  ];
}

function keyTable(variants: Question[][], L: (typeof LABELS)[string]) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text: string, bold = false) =>
    new TableCell({ borders, children: [line(text, { alignment: AlignmentType.CENTER, bold })] });
  const header = new TableRow({
    tableHeader: true,
    children: [cell(L.question, true), ...variants.map((_, v) => cell(variants.length > 1 ? `${v + 1}-${L.variant}` : L.answer, true))],
  });
  const rows = variants[0]!.map(
    (_, i) => new TableRow({ children: [cell(String(i + 1)), ...variants.map((qs) => cell(LETTERS[qs[i]!.correct]!))] }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
}

export const quizService: ServiceDef = {
  id: "quiz",
  title: "✅ Test tayyorlash",
  cost: COUNTS[0]!.cost,
  costFor: (a) => countOf(a.count).cost,
  enabled: true,
  eta: "20-60 soniya",
  steps: [
    {
      key: "topic",
      kind: "text",
      question:
        "📚 Fan va mavzuni yozing. Qancha aniq yozsangiz, savollar shuncha mos bo'ladi.\n\n" +
        "Masalan: <i>Biologiya, hujayra tuzilishi va organoidlari</i>",
      minLength: 3,
      maxLength: 500,
    },
    { key: "level", kind: "choice", question: "👥 Test kimlar uchun?", options: LEVELS, columns: 2 },
    {
      key: "count",
      kind: "choice",
      question: `🔢 Nechta savol?\n\n${COUNTS.map((c) => `${c.value} ta savol: ${c.cost} kredit`).join("\n")}`,
      options: COUNTS.map((c) => ({ label: `${c.value} ta`, value: c.value })),
      columns: 4,
    },
    { key: "difficulty", kind: "choice", question: "📈 Qiyinlik darajasi:", options: DIFFICULTY, columns: 2 },
    {
      key: "variants",
      kind: "choice",
      question: "🔀 Nechta variant kerak? Variantlarda savollar va javoblar tartibi aralashtiriladi, ko'chirishning oldi olinadi.",
      options: [
        { label: "1 variant", value: "1" },
        { label: "2 variant", value: "2" },
        { label: "4 variant", value: "4" },
      ],
      columns: 3,
    },
    { key: "language", kind: "choice", question: "🌐 Test qaysi tilda bo'lsin?", options: LANGUAGE_OPTIONS, columns: 2 },
  ],

  async generate(a, deps) {
    const count = Number(countOf(a.count).value);
    const language = a.language ?? "uz_latn";
    const { data, usage } = await deps.gemini.generateJson(
      QuizSchema,
      `Mavzu: ${a.topic}\nKimlar uchun: ${a.level}\nQiyinlik: ${a.difficulty}\nSavollar soni: aniq ${count} ta\n` +
        `Til: ${LANGUAGE_PROMPT[language]}. Har bir savolda 4 ta javob varianti.`,
      SYSTEM,
      { temperature: 0.6 },
    );
    const questions = data.questions.slice(0, count);
    const L = LABELS[language] ?? LABELS.uz_latn!;
    const variantCount = Math.min(4, Math.max(1, Number(a.variants) || 1));
    const variants = Array.from({ length: variantCount }, (_, v) => makeVariant(questions, v));

    const margins = { top: mm(15), bottom: mm(15), left: mm(20), right: mm(15) };
    const file = await buildDocx(data.title, [
      {
        margins,
        children: variants.flatMap((qs, v) =>
          variantPages(data.title, qs, variantCount > 1 ? `${v + 1}-${L.variant}` : null, L, v === 0),
        ),
      },
      { margins, children: [line(L.key, { alignment: AlignmentType.CENTER, bold: true, size: 28 }), line(""), keyTable(variants, L)] },
    ]);

    return {
      file,
      filename: `${safeFilename(data.title, "test")}.docx`,
      caption:
        `✅ Test tayyor: <b>${escapeHtml(data.title)}</b>\n` +
        `${questions.length} ta savol, ${variantCount} ta variant. Javoblar kaliti oxirgi sahifada.\n\n` +
        `⚠️ Tarqatishdan oldin savollarni ko'rib chiqing.`,
      usage: { ...usage, images: 0 },
    };
  },
};
