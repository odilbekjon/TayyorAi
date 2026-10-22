import { z } from "zod";
import { formatTashkent } from "../../db/stats.js";
import { safeFilename } from "../../lib/files.js";
import { GOOGLE_FONTS, esc, htmlToPdf, mmToPx, page, renderHtml } from "../../lib/html-render.js";
import { escapeHtml } from "../../lib/html.js";
import { LANGUAGE_OPTIONS, LANGUAGE_PROMPT, type Answers, type ServiceDef } from "../types.js";

const KINDS = [
  { label: "🏅 Sertifikat", value: "sertifikat" },
  { label: "🎓 Diplom", value: "diplom" },
  { label: "🏆 Faxriy yorliq", value: "faxriy yorliq" },
  { label: "🙏 Tashakkurnoma", value: "tashakkurnoma" },
  { label: "⭐ Maqtov yorlig'i", value: "maqtov yorlig'i" },
];

/** Bir nechta ism bo'lsa, har biriga alohida sahifa: narx ismlar soniga bog'liq */
const MAX_NAMES = 50;
const TIERS = [
  { upTo: 5, cost: 6 },
  { upTo: 20, cost: 10 },
  { upTo: MAX_NAMES, cost: 15 },
];
const namesOf = (a: Answers) =>
  (a.names ?? "")
    .split("\n")
    .map((n) => n.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_NAMES);
const costForNames = (count: number) => (TIERS.find((t) => count <= t.upTo) ?? TIERS.at(-1)!).cost;

const CertificateSchema = z.object({
  title: z.string().describe("Katta sarlavha, masalan: SERTIFIKAT yoki FAXRIY YORLIQ"),
  preText: z.string().describe("Ism ustidagi qisqa qator, masalan: Ushbu sertifikat egasi"),
  text: z.string().describe("Nima uchun berilgani, 1-2 gap, ismni takrorlamasdan"),
  organization: z.string().describe("Beruvchi tashkilot nomi"),
  signerRole: z.string().describe("Imzo chekuvchining lavozimi, berilmagan bo'lsa bo'sh"),
  signerName: z.string().describe("Imzo chekuvchining ismi, masalan: A. Karimov, berilmagan bo'lsa bo'sh"),
  date: z.string().describe("Sana, masalan: 22.10.2026 yoki 2026-yil 22-oktabr"),
  place: z.string().describe("Shahar, berilmagan bo'lsa bo'sh"),
});
type Certificate = z.infer<typeof CertificateSchema>;

const SYSTEM = `Siz sertifikat, diplom va faxriy yorliqlar matnini rasmiy va chiroyli uslubda yozasiz.
- Matn qisqa, tantanali va aniq bo'lsin: 1-2 gap.
- Matn ism bilan bog'lanmasin: ism alohida qatorda yoziladi, matnda "u", "uning" yoki ismni ishlatmang.
- Tashkilot, imzo chekuvchi, sana va shaharni foydalanuvchi bergan holicha yozing, o'ylab topmang.
- Sarlavhani bosh harflar bilan yozing.`;

// A4 albom: 297 × 210 mm
const W = mmToPx(297);
const H = mmToPx(210);

const seal = (color: string, ribbon: string) =>
  `<svg width="120" height="150" viewBox="0 0 120 150"><path d="M38 80 22 146l22-12 14 18 8-62zM82 80l16 66-22-12-14 18-8-62z" fill="${ribbon}"/>` +
  `<g transform="translate(60 60)">${Array.from({ length: 24 }, (_, i) => `<path d="M0-56 7-44H-7z" fill="${color}" transform="rotate(${i * 15})"/>`).join("")}` +
  `<circle r="46" fill="${color}"/><circle r="38" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3" opacity=".8"/>` +
  `<path d="M0-17 5-5h13L8 3l4 13L0 8l-12 8 4-13-10-8H-5z" fill="#fff"/></g></svg>`;

interface Style {
  id: string;
  label: string;
  css: string;
  decor: string;
  seal: string;
}

const STYLES: Style[] = [
  {
    id: "klassik",
    label: "🟨 Klassik oltin",
    css: `.pg{background:#fffaf0}
.b1{position:absolute;inset:26px;border:3px solid #b8892d}.b2{position:absolute;inset:36px;border:1px solid #d9b866}
.corner{position:absolute;width:70px;height:70px;border:3px solid #b8892d}
.c1{top:46px;left:46px;border-right:0;border-bottom:0}.c2{top:46px;right:46px;border-left:0;border-bottom:0}
.c3{bottom:46px;left:46px;border-right:0;border-top:0}.c4{bottom:46px;right:46px;border-left:0;border-top:0}
.title{color:#9a6f1c}.org,.pre,.lbl{color:#7c6a4a}.name{color:#1f2a44}.text{color:#3b3428}.rule,.sig{background:#b8892d}`,
    decor: `<div class="b1"></div><div class="b2"></div><div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>`,
    seal: seal("#b8892d", "#8a2b2b"),
  },
  {
    id: "zamonaviy",
    label: "🟦 Zamonaviy",
    css: `.pg{background:#fff}
.band{position:absolute;left:0;top:0;bottom:0;width:150px;background:linear-gradient(160deg,#1e3a8a,#2563eb)}
.band2{position:absolute;left:150px;top:0;bottom:0;width:10px;background:#f59e0b}
.tri{position:absolute;right:0;top:0;width:0;height:0;border-top:160px solid #dbeafe;border-left:160px solid transparent}
.wrap{left:200px!important}
.title{color:#1e3a8a;font-family:Montserrat,Arial,sans-serif!important;font-weight:800!important;letter-spacing:10px!important}
.org,.pre,.lbl{color:#64748b}.name{color:#0f172a}.text{color:#334155}.rule{background:#f59e0b}.sig{background:#94a3b8}
.foot{left:200px!important}`,
    decor: `<div class="band"></div><div class="band2"></div><div class="tri"></div>`,
    seal: seal("#2563eb", "#f59e0b"),
  },
  {
    id: "rasmiy",
    label: "🟩 Rasmiy",
    css: `.pg{background:#f7f9f6}
.b1{position:absolute;inset:0;border:30px solid #14532d}.b2{position:absolute;inset:40px;border:2px solid #c9a24b}
.b3{position:absolute;inset:48px;border:1px solid rgba(201,162,75,.6)}
.title{color:#14532d}.org,.pre,.lbl{color:#4b5d50}.name{color:#14532d}.text{color:#28332b}.rule,.sig{background:#c9a24b}`,
    decor: `<div class="b1"></div><div class="b2"></div><div class="b3"></div>`,
    seal: seal("#c9a24b", "#14532d"),
  },
  {
    id: "bolalar",
    label: "🌈 Bolalar uchun",
    css: `.pg{background:#fffdf5}
.dot{position:absolute;border-radius:50%}
.d1{width:220px;height:220px;left:-70px;top:-70px;background:#fde68a}.d2{width:140px;height:140px;left:110px;top:-60px;background:#a7f3d0}
.d3{width:240px;height:240px;right:-80px;bottom:-90px;background:#fbcfe8}.d4{width:130px;height:130px;right:130px;bottom:-60px;background:#bfdbfe}
.d5{width:60px;height:60px;right:70px;top:60px;background:#c4b5fd}.d6{width:44px;height:44px;left:70px;top:46%;background:#fdba74}
.b1{position:absolute;inset:30px;border:4px dashed #f472b6;border-radius:28px}
.title{color:#db2777;font-family:Montserrat,Arial,sans-serif!important;font-weight:800!important}
.org,.pre,.lbl{color:#6b7280}.name{color:#7c3aed}.text{color:#374151}.rule{background:#f472b6}.sig{background:#9ca3af}`,
    decor: `<div class="dot d1"></div><div class="dot d2"></div><div class="dot d3"></div><div class="dot d4"></div><div class="dot d5"></div><div class="dot d6"></div><div class="b1"></div>`,
    seal: seal("#f59e0b", "#db2777"),
  },
];

const CSS = `
.pg{position:relative;width:${W}px;height:${H}px;overflow:hidden}
.wrap{position:absolute;left:110px;right:110px;top:78px;bottom:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px}
.org{font-family:Montserrat,Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:3px;text-transform:uppercase}
.title{font-family:"Playfair Display",Georgia,serif;font-size:64px;font-weight:700;letter-spacing:6px;line-height:1.1}
.pre{font-family:Montserrat,Arial,sans-serif;font-size:15px;letter-spacing:4px;text-transform:uppercase;margin-top:6px}
.name{font-family:"Great Vibes","Playfair Display",cursive;line-height:1.15;margin-top:2px}
.rule{width:420px;height:1.5px}
.text{font-family:Lora,Georgia,serif;font-size:19px;line-height:1.6;font-style:italic;max-width:700px}
.foot{position:absolute;left:120px;right:120px;bottom:66px;display:flex;align-items:flex-end;justify-content:space-between}
.col{width:250px;text-align:center;font-family:Montserrat,Arial,sans-serif}
.val{font-size:15px;font-weight:600;min-height:20px;color:#1f2937}.sig{height:1px;margin:6px 0}.lbl{font-size:12px;letter-spacing:1px}
.seal{width:120px;height:150px;margin-bottom:-24px}`;

const LABELS: Record<string, { date: string }> = {
  uz_latn: { date: "Sana" },
  uz_cyrl: { date: "Сана" },
  ru: { date: "Дата" },
  en: { date: "Date" },
};

function certificateBody(c: Certificate, name: string, style: Style, language: string) {
  const L = LABELS[language] ?? LABELS.uz_latn!;
  // Uzun ismlar bitta qatorga sig'ishi uchun shrift kichrayadi
  const size = name.length > 34 ? 50 : name.length > 24 ? 60 : 72;
  return `<div class="pg">${style.decor}<div class="wrap">
<div class="org">${esc(c.organization)}</div><div class="title">${esc(c.title)}</div><div class="pre">${esc(c.preText)}</div>
<div class="name" style="font-size:${size}px">${esc(name)}</div><div class="rule"></div><div class="text">${esc(c.text)}</div></div>
<div class="foot">
<div class="col"><div class="val">${esc([c.date, c.place].filter(Boolean).join(", "))}</div><div class="sig"></div><div class="lbl">${esc(L.date)}</div></div>
<div class="seal">${style.seal}</div>
<div class="col"><div class="val">${esc(c.signerName)}</div><div class="sig"></div><div class="lbl">${esc(c.signerRole)}</div></div>
</div></div>`;
}

export function certificateHtml(c: Certificate, name: string, styleId: string | undefined, language = "uz_latn") {
  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0]!;
  return page(W, H, CSS + style.css, certificateBody(c, name, style, language));
}

/** Ko'p sahifali PDF: har bir ism alohida sahifada */
function certificatesHtml(c: Certificate, names: string[], styleId: string | undefined, language: string) {
  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0]!;
  return `<!doctype html><html><head><meta charset="utf-8">${GOOGLE_FONTS}<style>
*{margin:0;padding:0;box-sizing:border-box}body{-webkit-font-smoothing:antialiased}
@page{size:297mm 210mm;margin:0}.pg{break-after:page}.pg:last-child{break-after:auto}
${CSS}${style.css}</style></head><body>${names.map((n) => certificateBody(c, n, style, language)).join("")}</body></html>`;
}

export const certificateService: ServiceDef = {
  id: "certificate",
  title: "🏅 Sertifikat / diplom",
  cost: TIERS[0]!.cost,
  costFor: (a) => costForNames(namesOf(a).length),
  enabled: true,
  eta: "20-60 soniya",
  steps: [
    { key: "kind", kind: "choice", question: "🏅 Nima tayyorlaymiz?", options: KINDS, columns: 2 },
    {
      key: "names",
      kind: "text",
      question:
        `👤 Kimga beriladi? F.I.Sh. yozing.\n\nBir nechta odamga kerak bo'lsa, har birini <b>yangi qatorga</b> yozing ` +
        `(ko'pi bilan ${MAX_NAMES} ta), har biriga alohida sahifa tayyorlanadi.\n\n` +
        `💰 ${TIERS.map((t, i) => `${i === 0 ? 1 : TIERS[i - 1]!.upTo + 1}-${t.upTo} ta ism: ${t.cost} kredit`).join(", ")}`,
      minLength: 3,
      maxLength: 3000,
      validate: (v) => {
        const count = v.split("\n").filter((l) => l.trim()).length;
        return count > MAX_NAMES ? `Ko'pi bilan ${MAX_NAMES} ta ism yozing (siz ${count} ta yozdingiz).` : undefined;
      },
    },
    {
      key: "reason",
      kind: "text",
      question: "📝 Nima uchun beriladi?\n\nMasalan: <i>IELTS tayyorlov kursini muvaffaqiyatli tamomlagani uchun</i>",
      minLength: 5,
      maxLength: 500,
    },
    {
      key: "org",
      kind: "text",
      question:
        "🏛 Tashkilot nomi va imzo chekuvchi (lavozimi, ismi).\n\nMasalan: <i>Smart Academy o'quv markazi, direktor A. Karimov</i>",
      minLength: 3,
      maxLength: 300,
    },
    {
      key: "date",
      kind: "text",
      question: "📅 Sana va shahar (ixtiyoriy). O'tkazib yuborsangiz, bugungi sana qo'yiladi.\n\nMasalan: <i>20-oktabr 2026, Toshkent</i>",
      maxLength: 100,
      optional: true,
    },
    { key: "style", kind: "choice", question: "🎨 Dizaynni tanlang:", options: STYLES.map((s) => ({ label: s.label, value: s.id })), columns: 2 },
    { key: "language", kind: "choice", question: "🌐 Qaysi tilda bo'lsin?", options: LANGUAGE_OPTIONS, columns: 2 },
  ],

  async generate(a, deps) {
    const language = a.language ?? "uz_latn";
    const names = namesOf(a);
    if (!names.length) throw new Error("Ism yozilmagan");
    const { data, usage } = await deps.gemini.generateJson(
      CertificateSchema,
      `Turi: ${a.kind}. Til: ${LANGUAGE_PROMPT[language]}.\nNima uchun: ${a.reason}\nTashkilot va imzo chekuvchi: ${a.org}\n` +
        `Sana va shahar: ${a.date || `${formatTashkent(new Date()).slice(0, 10)} (sanani DD.MM.YYYY ko'rinishida yozing), shahar berilmagan`}`,
      SYSTEM,
    );

    const { png, pdf } = await renderHtml(certificateHtml(data, names[0]!, a.style, language), W, H, 2);
    const kind = safeFilename(a.kind ?? "sertifikat", "sertifikat");
    if (names.length === 1) {
      const name = safeFilename(names[0]!, "sertifikat");
      return {
        file: pdf,
        filename: `${name} - ${kind}.pdf`,
        preview: png,
        extra: [{ file: png, filename: `${name} - ${kind}.png` }],
        caption: `✅ Tayyor: <b>${escapeHtml(names[0]!)}</b>\n\nPDF'ni A4 albom formatda rangli printerda chop eting.`,
        usage: { ...usage, images: 0 },
      };
    }

    await deps.progress?.(`${names.length} ta sahifa chizilmoqda...`);
    const file = await htmlToPdf(certificatesHtml(data, names, a.style, language), { width: "297mm", height: "210mm" });
    return {
      file,
      filename: `${kind} - ${names.length} ta.pdf`,
      preview: png,
      caption: `✅ ${names.length} ta ${escapeHtml(a.kind ?? "sertifikat")} tayyor: har biri alohida sahifada.\n\nPDF'ni A4 albom formatda rangli printerda chop eting.`,
      usage: { ...usage, images: 0 },
    };
  },
};
