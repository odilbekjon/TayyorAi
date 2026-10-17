import ExcelJS from "exceljs";
import { z } from "zod";
import { safeFilename } from "../../lib/files.js";
import { escapeHtml } from "../../lib/html.js";
import type { Answers, ServiceDef } from "../types.js";

// ——— Umumiy uslublar ———
const ACCENT = "FF1E3A8A";
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
const INPUT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

function money(currency: string) {
  return currency === "USD" ? '"$"#,##0.00;[Red]-"$"#,##0.00' : '#,##0" so\'m";[Red]-#,##0" so\'m"';
}

function title(ws: ExcelJS.Worksheet, text: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols);
  const c = ws.getCell(1, 1);
  c.value = text;
  c.font = { bold: true, size: 16, color: { argb: ACCENT } };
  ws.getRow(1).height = 28;
}

function header(ws: ExcelJS.Worksheet, rowNo: number, labels: string[]) {
  const row = ws.getRow(rowNo);
  labels.forEach((l, i) => {
    const c = row.getCell(i + 1);
    c.value = l;
    c.font = HEADER_FONT;
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = THIN;
  });
  row.height = 22;
}

function styleRow(row: ExcelJS.Row, cols: number, fmt: string, fromCol = 2, fill?: ExcelJS.Fill) {
  for (let i = 1; i <= cols; i++) {
    const c = row.getCell(i);
    c.border = THIN;
    if (i >= fromCol) c.numFmt = fmt;
    if (fill) c.fill = fill;
  }
}

const NOTE = "Sariq kataklarni o'zingiz o'zgartiring: qolgan hisob-kitoblar formulalar orqali avtomatik yangilanadi.";

// ——— 1. Oylik byudjet ———
const BudgetSchema = z.object({
  title: z.string(),
  incomes: z.array(z.object({ name: z.string(), amount: z.number().nonnegative() })).min(1),
  expenses: z.array(z.object({ category: z.string(), name: z.string(), amount: z.number().nonnegative() })).min(1),
});

function buildBudget(wb: ExcelJS.Workbook, d: z.infer<typeof BudgetSchema>, fmt: string) {
  const ws = wb.addWorksheet("Byudjet", { views: [{ state: "frozen", ySplit: 3 }] });
  ws.columns = [{ width: 18 }, { width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }];
  title(ws, d.title, 5);
  ws.getCell("A2").value = NOTE;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };

  let r = 4;
  header(ws, r, ["Daromad", "Nomi", "Reja", "Haqiqiy", "Farq"]);
  const incFirst = r + 1;
  for (const inc of d.incomes) {
    r++;
    const row = ws.getRow(r);
    row.values = ["", inc.name, inc.amount, null];
    row.getCell(5).value = { formula: `IF(D${r}="","",D${r}-C${r})` };
    styleRow(row, 5, fmt, 3);
    row.getCell(3).fill = INPUT_FILL;
    row.getCell(4).fill = INPUT_FILL;
  }
  const incLast = r;
  r++;
  const incTotal = r;
  ws.getRow(r).values = ["", "Jami daromad"];
  ["C", "D", "E"].forEach((col) => (ws.getCell(`${col}${r}`).value = { formula: `SUM(${col}${incFirst}:${col}${incLast})` }));
  styleRow(ws.getRow(r), 5, fmt, 3, TOTAL_FILL);
  ws.getRow(r).font = { bold: true };

  r += 2;
  header(ws, r, ["Toifa", "Xarajat", "Reja", "Haqiqiy", "Tejaldi"]);
  const expFirst = r + 1;
  for (const e of d.expenses) {
    r++;
    const row = ws.getRow(r);
    row.values = [e.category, e.name, e.amount, null];
    row.getCell(5).value = { formula: `IF(D${r}="","",C${r}-D${r})` };
    styleRow(row, 5, fmt, 3);
    row.getCell(3).fill = INPUT_FILL;
    row.getCell(4).fill = INPUT_FILL;
  }
  const expLast = r;
  r++;
  const expTotal = r;
  ws.getRow(r).values = ["", "Jami xarajat"];
  ["C", "D", "E"].forEach((col) => (ws.getCell(`${col}${r}`).value = { formula: `SUM(${col}${expFirst}:${col}${expLast})` }));
  styleRow(ws.getRow(r), 5, fmt, 3, TOTAL_FILL);
  ws.getRow(r).font = { bold: true };

  r += 2;
  ws.getRow(r).values = ["", "QOLDIQ (daromad − xarajat)"];
  ws.getCell(`C${r}`).value = { formula: `C${incTotal}-C${expTotal}` };
  ws.getCell(`D${r}`).value = { formula: `D${incTotal}-D${expTotal}` };
  styleRow(ws.getRow(r), 5, fmt, 3, TOTAL_FILL);
  ws.getRow(r).font = { bold: true, size: 12 };
  ws.addConditionalFormatting({
    ref: `C${r}:D${r}`,
    rules: [{ type: "cellIs", operator: "lessThan", formulae: ["0"], priority: 1, style: { font: { color: { argb: "FFDC2626" }, bold: true } } }],
  });
}

// ——— 2. Biznes reja: 12 oylik prognoz ———
const BusinessSchema = z.object({
  title: z.string(),
  startupCosts: z.array(z.object({ name: z.string(), amount: z.number().nonnegative() })),
  revenues: z.array(z.object({ name: z.string(), monthlyAmount: z.number().nonnegative() })).min(1),
  monthlyCosts: z.array(z.object({ name: z.string(), amount: z.number().nonnegative() })).min(1),
  monthlyGrowthPercent: z.number().min(0).max(50).describe("Daromadning oylik o'sishi, foizda"),
});

function col(n: number) {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function buildBusiness(wb: ExcelJS.Workbook, d: z.infer<typeof BusinessSchema>, fmt: string) {
  const ws = wb.addWorksheet("Prognoz", { views: [{ state: "frozen", xSplit: 2, ySplit: 5 }] });
  const months = 12;
  const lastCol = 2 + months + 1; // nom, boshlang'ich (bo'sh), 12 oy, jami
  ws.columns = [{ width: 30 }, { width: 4 }, ...Array.from({ length: months + 1 }, () => ({ width: 15 }))];
  title(ws, d.title, lastCol);
  ws.getCell("A2").value = NOTE;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };
  ws.getCell("A3").value = "Daromadning oylik o'sishi";
  ws.getCell("C3").value = d.monthlyGrowthPercent / 100;
  ws.getCell("C3").numFmt = "0.0%";
  ws.getCell("C3").fill = INPUT_FILL;
  ws.getCell("C3").border = THIN;
  const growth = "$C$3";

  header(ws, 5, ["Ko'rsatkich", "", ...Array.from({ length: months }, (_, i) => `${i + 1}-oy`), "Jami"]);
  const firstMonth = 3;
  const lastMonth = firstMonth + months - 1;
  const totalCol = col(lastMonth + 1);
  let r = 5;

  const section = (label: string) => {
    r++;
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { bold: true, color: { argb: ACCENT } };
  };
  const sumRow = (label: string, from: number, to: number) => {
    r++;
    ws.getCell(`A${r}`).value = label;
    for (let c = firstMonth; c <= lastMonth + 1; c++) ws.getCell(r, c).value = { formula: `SUM(${col(c)}${from}:${col(c)}${to})` };
    styleRow(ws.getRow(r), lastCol, fmt, 3, TOTAL_FILL);
    ws.getRow(r).font = { bold: true };
    return r;
  };

  section("DAROMADLAR");
  const revFirst = r + 1;
  for (const rev of d.revenues) {
    r++;
    ws.getCell(`A${r}`).value = rev.name;
    ws.getCell(r, firstMonth).value = rev.monthlyAmount;
    ws.getCell(r, firstMonth).fill = INPUT_FILL;
    for (let c = firstMonth + 1; c <= lastMonth; c++) ws.getCell(r, c).value = { formula: `${col(c - 1)}${r}*(1+${growth})` };
    ws.getCell(`${totalCol}${r}`).value = { formula: `SUM(${col(firstMonth)}${r}:${col(lastMonth)}${r})` };
    styleRow(ws.getRow(r), lastCol, fmt, 3);
  }
  const revTotal = sumRow("Jami daromad", revFirst, r);

  section("OYLIK XARAJATLAR");
  const costFirst = r + 1;
  for (const c of d.monthlyCosts) {
    r++;
    ws.getCell(`A${r}`).value = c.name;
    ws.getCell(r, firstMonth).value = c.amount;
    ws.getCell(r, firstMonth).fill = INPUT_FILL;
    for (let k = firstMonth + 1; k <= lastMonth; k++) ws.getCell(r, k).value = { formula: `${col(firstMonth)}${r}` };
    ws.getCell(`${totalCol}${r}`).value = { formula: `SUM(${col(firstMonth)}${r}:${col(lastMonth)}${r})` };
    styleRow(ws.getRow(r), lastCol, fmt, 3);
  }
  const costTotal = sumRow("Jami xarajat", costFirst, r);

  r += 2;
  ws.getCell(`A${r}`).value = "SOF FOYDA";
  for (let c = firstMonth; c <= lastMonth + 1; c++) ws.getCell(r, c).value = { formula: `${col(c)}${revTotal}-${col(c)}${costTotal}` };
  styleRow(ws.getRow(r), lastCol, fmt, 3, TOTAL_FILL);
  ws.getRow(r).font = { bold: true };
  const profit = r;

  // Boshlang'ich xarajatlar alohida varaqda
  const st = wb.addWorksheet("Boshlang'ich xarajatlar");
  st.columns = [{ width: 36 }, { width: 18 }];
  title(st, "Boshlang'ich investitsiya", 2);
  header(st, 3, ["Nomi", "Summa"]);
  let sr = 3;
  for (const s of d.startupCosts) {
    sr++;
    st.getRow(sr).values = [s.name, s.amount];
    styleRow(st.getRow(sr), 2, fmt, 2);
    st.getCell(`B${sr}`).fill = INPUT_FILL;
  }
  sr++;
  st.getRow(sr).values = ["Jami"];
  st.getCell(`B${sr}`).value = { formula: d.startupCosts.length ? `SUM(B4:B${sr - 1})` : "0" };
  styleRow(st.getRow(sr), 2, fmt, 2, TOTAL_FILL);
  st.getRow(sr).font = { bold: true };
  const startupRef = `'Boshlang''ich xarajatlar'!$B$${sr}`;

  r++;
  ws.getCell(`A${r}`).value = "Jamg'arilgan natija (investitsiya hisobga olingan)";
  for (let c = firstMonth; c <= lastMonth; c++) {
    ws.getCell(r, c).value = { formula: c === firstMonth ? `${col(c)}${profit}-${startupRef}` : `${col(c - 1)}${r}+${col(c)}${profit}` };
  }
  styleRow(ws.getRow(r), lastCol, fmt, 3);
  ws.addConditionalFormatting({
    ref: `${col(firstMonth)}${profit}:${totalCol}${r}`,
    rules: [{ type: "cellIs", operator: "lessThan", formulae: ["0"], priority: 1, style: { font: { color: { argb: "FFDC2626" } } } }],
  });
}

// ——— 3. Kredit / qarz jadvali ———
const LoanSchema = z.object({
  title: z.string(),
  principal: z.number().positive(),
  annualRatePercent: z.number().min(0).max(200),
  months: z.number().int().min(1).max(360),
  method: z.enum(["annuitet", "differensial"]),
});

function buildLoan(wb: ExcelJS.Workbook, d: z.infer<typeof LoanSchema>, fmt: string) {
  const ws = wb.addWorksheet("Kredit jadvali", { views: [{ state: "frozen", ySplit: 9 }] });
  ws.columns = [{ width: 10 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 20 }];
  title(ws, d.title, 6);
  ws.getCell("A2").value = NOTE;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };

  const params: Array<[string, number | string, string, boolean]> = [
    ["Kredit summasi", d.principal, fmt, true],
    ["Yillik foiz stavkasi", d.annualRatePercent / 100, "0.00%", true],
    ["Muddat (oy)", d.months, "0", false],
    ["To'lov turi", d.method, "@", false],
  ];
  params.forEach(([label, value, f, editable], i) => {
    const r = 3 + i;
    ws.getCell(`A${r}`).value = label;
    ws.mergeCells(`A${r}:B${r}`);
    const c = ws.getCell(`C${r}`);
    c.value = value;
    c.numFmt = f;
    if (editable) c.fill = INPUT_FILL;
    c.border = THIN;
  });
  // Muddat jadval qatorlari soniga bog'liq, shuning uchun uni o'zgartirsangiz botdan qayta yasating
  ws.getCell("D5").value = "(muddat yoki turni o'zgartirish uchun jadvalni botda qayta yarating)";
  ws.getCell("D5").font = { italic: true, size: 9, color: { argb: "FF64748B" } };

  header(ws, 9, ["Oy", "Boshidagi qoldiq", "Asosiy qarz", "Foiz", "Oylik to'lov", "Oxiridagi qoldiq"]);
  const P = "$C$3";
  const rate = "($C$4/12)";
  const n = "$C$5";
  const first = 10;
  for (let m = 1; m <= d.months; m++) {
    const r = first + m - 1;
    const row = ws.getRow(r);
    row.getCell(1).value = m;
    row.getCell(2).value = m === 1 ? { formula: P } : { formula: `F${r - 1}` };
    row.getCell(4).value = { formula: `B${r}*${rate}` };
    if (d.method === "annuitet") {
      // PMT: teng oylik to'lov
      row.getCell(5).value = { formula: `IF(${rate}=0,${P}/${n},PMT(${rate},${n},-${P}))` };
      row.getCell(3).value = { formula: `E${r}-D${r}` };
    } else {
      row.getCell(3).value = { formula: `${P}/${n}` };
      row.getCell(5).value = { formula: `C${r}+D${r}` };
    }
    row.getCell(6).value = { formula: `MAX(B${r}-C${r},0)` };
    styleRow(row, 6, fmt, 2);
  }
  const last = first + d.months - 1;
  const t = last + 1;
  ws.getCell(`A${t}`).value = "Jami";
  ["C", "D", "E"].forEach((c) => (ws.getCell(`${c}${t}`).value = { formula: `SUM(${c}${first}:${c}${last})` }));
  styleRow(ws.getRow(t), 6, fmt, 2, TOTAL_FILL);
  ws.getRow(t).font = { bold: true };
}

// ——— Xizmat ———
const KINDS = [
  { label: "💰 Oylik byudjet", value: "byudjet" },
  { label: "📊 Biznes reja (12 oy)", value: "biznes" },
  { label: "🏦 Kredit to'lov jadvali", value: "kredit" },
];

const SYSTEM = `Siz moliyaviy maslahatchisiz. Foydalanuvchi ma'lumotidan Excel jadval uchun aniq raqamlar tayyorlaysiz.
- Foydalanuvchi bergan raqamlarni aynan ishlating.
- Berilmagan, lekin jadval uchun kerak bo'lgan bandlarni O'zbekiston sharoitiga mos, real taxminiy qiymatlar bilan to'ldiring.
- Nomlarni o'zbek tilida (lotin) qisqa yozing. Summalarni tanlangan valyutada, oddiy son ko'rinishida bering.`;

const PROMPTS: Record<string, string> = {
  byudjet: "Oylik shaxsiy yoki oilaviy byudjet tuzing: daromad manbalari va toifalarga ajratilgan 8-15 ta xarajat bandi.",
  biznes: "12 oylik biznes moliyaviy prognoz tuzing: boshlang'ich xarajatlar, daromad manbalari (1-oy uchun summa), doimiy oylik xarajatlar va daromadning oylik o'sish foizi.",
  kredit: "Kredit parametrlarini aniqlang: summa, yillik foiz, muddat (oy) va to'lov turi. Turi aytilmagan bo'lsa annuitet.",
};

export async function buildWorkbook(kind: string, data: unknown, currency: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TayyorAI";
  const fmt = money(currency);
  if (kind === "biznes") buildBusiness(wb, data as z.infer<typeof BusinessSchema>, fmt);
  else if (kind === "kredit") buildLoan(wb, data as z.infer<typeof LoanSchema>, fmt);
  else buildBudget(wb, data as z.infer<typeof BudgetSchema>, fmt);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function schemaFor(kind: string) {
  return kind === "biznes" ? BusinessSchema : kind === "kredit" ? LoanSchema : BudgetSchema;
}

export const excelService: ServiceDef = {
  id: "excel",
  title: "📈 Moliyaviy jadval (Excel)",
  cost: 5,
  enabled: true,
  eta: "15-30 soniya",
  steps: [
    { key: "kind", kind: "choice", question: "📈 Qanday jadval kerak?", options: KINDS },
    {
      key: "currency",
      kind: "choice",
      question: "💱 Valyuta:",
      options: [
        { label: "🇺🇿 So'm", value: "UZS" },
        { label: "🇺🇸 Dollar", value: "USD" },
      ],
      columns: 2,
    },
    {
      key: "details",
      kind: "text",
      question:
        "📝 Ma'lumotlarni erkin yozing.\n\n" +
        "Byudjet: <i>maosh 6 mln, ijara 2 mln, oziq-ovqat 1.5 mln...</i>\n" +
        "Biznes: <i>kofe shop, boshlang'ich 80 mln, kuniga 100 ta kofe 25 ming so'mdan...</i>\n" +
        "Kredit: <i>50 mln so'm, yillik 24%, 24 oy, annuitet</i>",
      minLength: 5,
      maxLength: 2000,
    },
  ],

  async generate(a: Answers, deps) {
    const kind = a.kind ?? "byudjet";
    const currency = a.currency ?? "UZS";
    const { data, usage } = await deps.gemini.generateJson(
      schemaFor(kind),
      `${PROMPTS[kind]}\nValyuta: ${currency === "USD" ? "AQSh dollari" : "o'zbek so'mi"}.\nFoydalanuvchi ma'lumoti: ${a.details}`,
      SYSTEM,
    );
    const file = await buildWorkbook(kind, data, currency);
    return {
      file,
      filename: `${safeFilename(data.title, "jadval")}.xlsx`,
      caption: `✅ Jadval tayyor: <b>${escapeHtml(data.title)}</b>\n\nSariq kataklarni o'zgartirsangiz, qolgan hisob-kitoblar avtomatik yangilanadi.`,
      usage: { ...usage, images: 0 },
    };
  },
};
