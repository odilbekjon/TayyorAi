import { z } from "zod";
import { safeFilename } from "../../lib/files.js";
import { esc, mmToPx, page, renderHtml } from "../../lib/html-render.js";
import { escapeHtml } from "../../lib/html.js";
import { ICONS } from "../../lib/icons.js";
import { LANGUAGE_OPTIONS, LANGUAGE_PROMPT, type ServiceDef } from "../types.js";

const EVENTS = [
  { label: "💍 Nikoh to'yi", value: "nikoh to'yi" },
  { label: "🤝 Fotiha to'yi", value: "fotiha to'yi" },
  { label: "🎂 Tug'ilgan kun", value: "tug'ilgan kun" },
  { label: "🎉 Yubiley", value: "yubiley" },
  { label: "👶 Beshik to'yi", value: "beshik to'yi" },
  { label: "🎊 Sunnat to'yi", value: "sunnat to'yi" },
  { label: "🏢 Korporativ tadbir", value: "korporativ tadbir" },
  { label: "📌 Boshqa tadbir", value: "tadbir" },
];

const InviteSchema = z.object({
  heading: z.string().describe("Yuqoridagi chiroyli sarlavha, 1-2 so'z, masalan: Taklifnoma"),
  names: z.string().describe("Asosiy ismlar yoki tadbir nomi, masalan: Jasur va Madina"),
  invitation: z.string().describe("Iliq, samimiy taklif matni, 2-4 gap"),
  date: z.string(),
  time: z.string(),
  place: z.string(),
  closing: z.string().describe("Pastki qator, masalan: Hurmat bilan, Aliyevlar oilasi"),
});
type Invite = z.infer<typeof InviteSchema>;

const SYSTEM = `Siz o'zbek an'analarini yaxshi biladigan taklifnoma matnlari muallifisiz.
- Matn samimiy, hurmatli va chiroyli bo'lsin, lekin ortiqcha uzun bo'lmasin.
- Sana, vaqt, manzil va ismlarni foydalanuvchi bergan holicha, faqat chiroyli formatda yozing. O'ylab topmang.
- Berilmagan ma'lumot uchun bo'sh qator qaytaring.`;

// A5: 148 × 210 mm
const W = mmToPx(148);
const H = mmToPx(210);

const ORNAMENT = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><g fill="none" stroke="#c9a24b" stroke-width="1.2"><path d="M20 2 38 20 20 38 2 20z"/><path d="M20 10 30 20 20 30 10 20z"/><circle cx="20" cy="20" r="2.5" fill="#c9a24b"/></g></svg>`,
);

interface Style {
  id: string;
  label: string;
  css: string;
}

const STYLES: Style[] = [
  {
    id: "milliy",
    label: "🟦 Milliy",
    css: `body{background:#fbf6ea}
.frame{position:absolute;inset:18px;border:14px solid transparent;border-image:url("data:image/svg+xml,${ORNAMENT}") 14 round;background:#fbf6ea}
.inner{position:absolute;inset:44px;border:1.5px solid #1d4e89;outline:1px solid #c9a24b;outline-offset:5px}
.heading{color:#1d4e89}.names{color:#7a2e0e}.text,.closing{color:#3b3024}.meta{color:#1d4e89}.ic{color:#c9a24b}.sep{background:#c9a24b}`,
  },
  {
    id: "zamonaviy",
    label: "⚪ Zamonaviy",
    css: `body{background:#fff}
.frame{position:absolute;inset:0;background:
radial-gradient(circle at 0 0,#fde2e4 0,#fde2e4 120px,transparent 121px),
radial-gradient(circle at 100% 100%,#e2ece9 0,#e2ece9 160px,transparent 161px)}
.inner{position:absolute;inset:36px;border:1px solid #d6d3d1}
.heading{color:#57534e}.names{color:#1c1917}.text,.closing{color:#44403c}.meta{color:#1c1917}.ic{color:#a8a29e}.sep{background:#a8a29e}`,
  },
  {
    id: "oltin",
    label: "🟩 Klassik oltin",
    css: `body{background:#0f3d2e}
.frame{position:absolute;inset:22px;border:2px solid #c9a24b}
.inner{position:absolute;inset:32px;border:1px solid rgba(201,162,75,.6)}
.heading{color:#e8c872}.names{color:#f5e6c4}.text,.closing{color:#e7dcc3}.meta{color:#f5e6c4}.ic{color:#e8c872}.sep{background:#c9a24b}`,
  },
  {
    id: "gulli",
    label: "🌸 Gulli",
    css: `body{background:#fff7f8}
.frame{position:absolute;inset:0;background:
radial-gradient(circle at 8% 6%,#f9c5d1 0 40px,transparent 41px),radial-gradient(circle at 16% 3%,#fbd5de 0 26px,transparent 27px),
radial-gradient(circle at 3% 14%,#fcdde4 0 30px,transparent 31px),radial-gradient(circle at 92% 94%,#f9c5d1 0 44px,transparent 45px),
radial-gradient(circle at 84% 97%,#fbd5de 0 28px,transparent 29px),radial-gradient(circle at 97% 86%,#fcdde4 0 32px,transparent 33px)}
.inner{position:absolute;inset:40px;border:1px solid #f3a6b8;border-radius:12px}
.heading{color:#be4b6b}.names{color:#7d2944}.text,.closing{color:#5b3a45}.meta{color:#7d2944}.ic{color:#e07a98}.sep{background:#f3a6b8}`,
  },
];

const CSS = `
.wrap{position:absolute;inset:60px 56px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:20px}
.heading{font-family:"Great Vibes","Playfair Display",cursive;font-size:76px;line-height:1}
.names{font-family:"Playfair Display",Georgia,serif;font-size:40px;font-weight:700;line-height:1.2}
.sep{width:70px;height:1.5px}
.text{font-family:Lora,Georgia,serif;font-size:17px;line-height:1.7;font-style:italic;max-width:400px}
.meta{font-family:Montserrat,Arial,sans-serif;font-size:15px;font-weight:600;display:flex;flex-direction:column;gap:9px;align-items:center}
.meta div{display:flex;align-items:center;gap:8px}.ic{display:inline-flex;font-size:17px}
.closing{font-family:Lora,Georgia,serif;font-size:15px;margin-top:8px}`;

export function inviteHtml(v: Invite, styleId: string | undefined) {
  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0]!;
  const meta = [
    v.date && `<div><span class="ic">${ICONS.calendar}</span>${esc(v.date)}</div>`,
    v.time && `<div><span class="ic">${ICONS.clock}</span>${esc(v.time)}</div>`,
    v.place && `<div><span class="ic">${ICONS.address}</span>${esc(v.place)}</div>`,
  ]
    .filter(Boolean)
    .join("");
  return page(
    W,
    H,
    CSS + style.css,
    `<div class="frame"></div><div class="inner"></div><div class="wrap">
<div class="heading">${esc(v.heading)}</div><div class="names">${esc(v.names)}</div><div class="sep"></div>
<div class="text">${esc(v.invitation)}</div><div class="meta">${meta}</div><div class="closing">${esc(v.closing)}</div></div>`,
  );
}

export const inviteService: ServiceDef = {
  id: "invite",
  title: "💌 Taklifnoma",
  cost: 8,
  enabled: true,
  eta: "15-30 soniya",
  steps: [
    { key: "event", kind: "choice", question: "🎉 Qanday tadbir?", options: EVENTS, columns: 2 },
    {
      key: "names",
      kind: "text",
      question: "👥 Kimlarning tadbiri va kimlar taklif qilmoqda?\n\nMasalan: <i>Jasur va Madinaning nikoh to'yi, taklif qiluvchi: Aliyevlar oilasi</i>",
      minLength: 3,
      maxLength: 200,
    },
    { key: "when", kind: "text", question: "📅 Sana va vaqt.\n\nMasalan: <i>15-noyabr, shanba, soat 18:00</i>", minLength: 3, maxLength: 100 },
    { key: "where", kind: "text", question: "📍 Manzil.\n\nMasalan: <i>\"Navro'z\" to'yxonasi, Toshkent, Chilonzor 5</i>", minLength: 3, maxLength: 150 },
    { key: "style", kind: "choice", question: "🎨 Uslubni tanlang:", options: STYLES.map((s) => ({ label: s.label, value: s.id })), columns: 2 },
    { key: "language", kind: "choice", question: "🌐 Taklifnoma tili:", options: LANGUAGE_OPTIONS, columns: 2 },
  ],

  async generate(a, deps) {
    const { data, usage } = await deps.gemini.generateJson(
      InviteSchema,
      `Tadbir: ${a.event}. Til: ${LANGUAGE_PROMPT[a.language ?? "uz_latn"]}.\nIsmlar va taklif qiluvchilar: ${a.names}\nSana va vaqt: ${a.when}\nManzil: ${a.where}`,
      SYSTEM,
    );
    const { png, pdf } = await renderHtml(inviteHtml(data, a.style), W, H, 2);
    const name = safeFilename(data.names, "taklifnoma");
    return {
      file: pdf,
      filename: `${name} - taklifnoma.pdf`,
      preview: png,
      extra: [{ file: png, filename: `${name} - taklifnoma.png` }],
      caption: `✅ Taklifnoma tayyor: <b>${escapeHtml(data.names)}</b>\n\nPNG'ni Telegram orqali yuboring, PDF'ni A5 formatda chop eting.`,
      usage: { ...usage, images: 0 },
    };
  },
};
