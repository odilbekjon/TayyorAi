import { z } from "zod";
import { safeFilename } from "../../lib/files.js";
import { esc, mmToPx, page, renderHtml } from "../../lib/html-render.js";
import { escapeHtml } from "../../lib/html.js";
import { ICONS } from "../../lib/icons.js";
import { findPhoto, toDataUri } from "../../lib/photos.js";
import { LANGUAGE_OPTIONS, LANGUAGE_PROMPT, type ServiceDef } from "../types.js";

const FlyerSchema = z.object({
  headline: z.string().describe("Diqqatni tortadigan sarlavha, 2-7 so'z"),
  subheadline: z.string().describe("Sarlavhani to'ldiruvchi 1 gap"),
  bullets: z.array(z.string()).min(2).max(4).describe("Qisqa afzalliklar, har biri 2-6 so'z"),
  offer: z.string().describe("Narx, chegirma yoki asosiy taklif, qisqa. Berilmagan bo'lsa bo'sh"),
  cta: z.string().describe("Harakatga chaqiruv, 2-4 so'z, masalan: Hoziroq yoziling!"),
  imageQuery: z.string().describe("Fon rasmi uchun 2-4 so'zli inglizcha qidiruv iborasi"),
});
type Flyer = z.infer<typeof FlyerSchema>;

const SYSTEM = `Siz tajribali marketing kopirayterisiz. Qisqa, kuchli va ishonchli reklama matni yozasiz.
- Faqat foydalanuvchi bergan faktlardan foydalaning: narx, chegirma, manzil, raqamlarni o'ylab topmang.
- Ortiqcha undov va bosh harflardan qoching, matn professional ko'rinsin.`;

interface Format {
  value: string;
  label: string;
  w: number;
  h: number;
  scale: number;
  /** Rasm egallaydigan balandlik ulushi */
  photo: number;
  /** Matn o'lchami koeffitsienti (kvadrat formatda joy kam) */
  type: number;
}

const FORMATS: Format[] = [
  { value: "a4", label: "📄 A4 (chop etish)", w: mmToPx(210), h: mmToPx(297), scale: 2.5, photo: 0.45, type: 1 },
  { value: "post", label: "🟦 Instagram post", w: 1080, h: 1080, scale: 1, photo: 0.36, type: 0.74 },
  { value: "story", label: "📱 Story / Reels", w: 1080, h: 1920, scale: 1, photo: 0.48, type: 1.12 },
];

interface Style {
  id: string;
  label: string;
  bg: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  heroFallback: string;
}

const STYLES: Style[] = [
  { id: "yorqin", label: "🟧 Yorqin", bg: "#fff7ed", text: "#1c1917", muted: "#57534e", accent: "#ea580c", onAccent: "#fff", heroFallback: "linear-gradient(135deg,#f97316,#facc15)" },
  { id: "minimal", label: "⚪ Minimal", bg: "#ffffff", text: "#0f172a", muted: "#475569", accent: "#2563eb", onAccent: "#fff", heroFallback: "linear-gradient(135deg,#1e40af,#38bdf8)" },
  { id: "premium", label: "⚫ Premium", bg: "#0b1220", text: "#f8fafc", muted: "#cbd5e1", accent: "#d4a843", onAccent: "#0b1220", heroFallback: "linear-gradient(135deg,#111827,#374151)" },
  { id: "yashil", label: "🟩 Tabiiy", bg: "#f0fdf4", text: "#052e16", muted: "#3f6212", accent: "#16a34a", onAccent: "#fff", heroFallback: "linear-gradient(135deg,#15803d,#84cc16)" },
];

export function flyerHtml(f: Flyer, contacts: string, formatId: string | undefined, styleId: string | undefined, photo?: string) {
  const fmt = FORMATS.find((x) => x.value === formatId) ?? FORMATS[0]!;
  const s = STYLES.find((x) => x.id === styleId) ?? STYLES[0]!;
  // Barcha o'lchamlar kenglikka nisbatan: bitta shablon uchala formatda ishlaydi
  const u = (fmt.w / 100) * fmt.type;
  const heroH = Math.round(fmt.h * fmt.photo);
  const hero = photo ? `url("${photo}") center/cover no-repeat` : s.heroFallback;

  const css = `
body{background:${s.bg};color:${s.text};font-family:Montserrat,Arial,sans-serif;position:relative}
.hero{position:absolute;left:0;top:0;width:100%;height:${heroH}px;background:${hero}}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,${s.bg} 100%)}
.deco{position:absolute;border-radius:50%;background:rgba(255,255,255,.15)}
.content{position:absolute;left:${7 * (fmt.w / 100)}px;right:${7 * (fmt.w / 100)}px;top:${heroH - 14 * u}px;bottom:${6 * u}px;display:flex;flex-direction:column;gap:${2.6 * u}px}
h1{font-size:${8.6 * u}px;line-height:1.05;font-weight:800;letter-spacing:-.5px}
.sub{font-size:${3.6 * u}px;line-height:1.4;color:${s.muted};font-weight:500}
ul{list-style:none;display:flex;flex-direction:column;gap:${1.5 * u}px}
li{display:flex;align-items:center;gap:${1.8 * u}px;font-size:${3.4 * u}px;font-weight:600}
li .ic{flex:none;width:${4.6 * u}px;height:${4.6 * u}px;border-radius:50%;background:${s.accent};color:${s.onAccent};display:flex;align-items:center;justify-content:center;font-size:${2.8 * u}px}
.offer{align-self:flex-start;background:${s.accent};color:${s.onAccent};font-weight:800;font-size:${4.6 * u}px;padding:${1.4 * u}px ${3 * u}px;border-radius:${1.5 * u}px;transform:rotate(-2deg)}
.spacer{flex:1}
.cta{font-size:${4.4 * u}px;font-weight:800;color:${s.accent}}
.contacts{font-size:${2.9 * u}px;color:${s.muted};font-weight:600;border-top:2px solid ${s.accent};padding-top:${1.6 * u}px;line-height:1.5}`;

  const decorations = photo
    ? ""
    : `<div class="deco" style="width:${40 * u}px;height:${40 * u}px;right:${-10 * u}px;top:${-12 * u}px"></div>
<div class="deco" style="width:${22 * u}px;height:${22 * u}px;left:${8 * u}px;top:${heroH * 0.25}px"></div>`;

  return page(
    fmt.w,
    fmt.h,
    css,
    `<div class="hero"></div>${decorations}<div class="content">
<h1>${esc(f.headline)}</h1><div class="sub">${esc(f.subheadline)}</div>
<ul>${f.bullets.map((b) => `<li><span class="ic">${ICONS.check}</span>${esc(b)}</li>`).join("")}</ul>
${f.offer ? `<div class="offer">${esc(f.offer)}</div>` : ""}
<div class="spacer"></div><div class="cta">${esc(f.cta)}</div><div class="contacts">${esc(contacts)}</div></div>`,
  );
}

export const flyerService: ServiceDef = {
  id: "flyer",
  title: "📣 Flayer",
  cost: 8,
  enabled: true,
  eta: "20-40 soniya",
  steps: [
    {
      key: "subject",
      kind: "text",
      question: "📣 Nimani reklama qilamiz?\n\nMasalan: <i>Ingliz tili kursi, IELTS 7+ ga tayyorlov</i>",
      minLength: 3,
      maxLength: 300,
    },
    {
      key: "offer",
      kind: "text",
      question: "💰 Asosiy taklif: narx, chegirma, muddat (ixtiyoriy).\n\nMasalan: <i>Birinchi oy 30% chegirma, 450 000 so'm</i>",
      maxLength: 200,
      optional: true,
    },
    {
      key: "contacts",
      kind: "text",
      question: "📞 Aloqa: telefon, manzil, Telegram yoki Instagram.\n\nMasalan: <i>+998 90 123 45 67, @english_center, Chilonzor 7</i>",
      minLength: 5,
      maxLength: 200,
    },
    { key: "format", kind: "choice", question: "📐 O'lcham:", options: FORMATS.map((f) => ({ label: f.label, value: f.value })), columns: 1 },
    { key: "style", kind: "choice", question: "🎨 Uslub:", options: STYLES.map((s) => ({ label: s.label, value: s.id })), columns: 2 },
    {
      key: "photo",
      kind: "choice",
      question: "🖼 Fon rasmi kerakmi?",
      options: [
        { label: "📷 Ha, mavzuga mos foto", value: "yes" },
        { label: "🎨 Yo'q, rangli fon", value: "no" },
      ],
      columns: 1,
    },
    { key: "language", kind: "choice", question: "🌐 Flayer tili:", options: LANGUAGE_OPTIONS, columns: 2 },
  ],

  async generate(a, deps) {
    const { data, usage } = await deps.gemini.generateJson(
      FlyerSchema,
      `Til: ${LANGUAGE_PROMPT[a.language ?? "uz_latn"]}.\nReklama mavzusi: ${a.subject}\nTaklif: ${a.offer ?? "berilmagan"}`,
      SYSTEM,
    );

    let photo: string | undefined;
    if (a.photo === "yes") {
      await deps.progress?.("🖼 Rasm qidirilmoqda...");
      const found = await findPhoto(data.imageQuery, {
        keys: deps.photoKeys,
        orientation: a.format === "post" ? "square" : "landscape",
      });
      if (found) photo = toDataUri(found);
    }

    const fmt = FORMATS.find((f) => f.value === a.format) ?? FORMATS[0]!;
    const { png, pdf } = await renderHtml(flyerHtml(data, a.contacts ?? "", a.format, a.style, photo), fmt.w, fmt.h, fmt.scale);
    const name = safeFilename(data.headline, "flayer");
    return {
      file: pdf,
      filename: `${name} - flayer.pdf`,
      preview: png,
      extra: [{ file: png, filename: `${name} - flayer.png` }],
      caption: `✅ Flayer tayyor: <b>${escapeHtml(data.headline)}</b>`,
      usage: { ...usage, images: photo ? 1 : 0 },
    };
  },
};
