import { z } from "zod";
import { esc, mmToPx, page, renderHtml } from "../../lib/html-render.js";
import { escapeHtml } from "../../lib/html.js";
import { ICONS, type IconName } from "../../lib/icons.js";
import { safeFilename } from "../../lib/files.js";
import type { ServiceDef } from "../types.js";

const CardSchema = z.object({
  fullName: z.string().min(1),
  position: z.string(),
  company: z.string(),
  contacts: z
    .array(z.object({ type: z.enum(["phone", "email", "website", "address", "telegram"]), value: z.string().min(1) }))
    .max(5),
});
type Card = z.infer<typeof CardSchema>;

const SYSTEM = `Siz vizitka ma'lumotlarini tartiblaysiz.
- Ism, lavozim va kompaniyani to'g'ri imlo va bosh harflar bilan yozing, mazmunini o'zgartirmang.
- Telefonni xalqaro formatda yozing: +998 90 123 45 67.
- Telegram uchun @username ko'rinishini qoldiring. Sayt manzilidan https:// ni olib tashlang.
- Berilmagan ma'lumotni o'ylab topmang, kompaniya berilmagan bo'lsa bo'sh qator qaytaring.`;

// Standart vizitka o'lchami: 90 × 50 mm
const W = mmToPx(90);
const H = mmToPx(50);

interface Template {
  id: string;
  label: string;
  css: string;
  body: (c: Card, initials: string) => string;
}

const contactList = (c: Card) =>
  c.contacts
    .map((x) => `<div class="row"><span class="ic">${ICONS[x.type as IconName]}</span><span>${esc(x.value)}</span></div>`)
    .join("");

const base = `
.card{width:${W}px;height:${H}px;position:relative;overflow:hidden;font-family:Montserrat,Arial,sans-serif}
.row{display:flex;align-items:center;gap:6px;font-size:8.5px;line-height:1.55;white-space:nowrap}
.ic{display:inline-flex;font-size:9px;flex:none}
.name{font-weight:700;font-size:17px;line-height:1.15}
.pos{font-size:9px;margin-top:3px;letter-spacing:.3px}
.comp{font-size:8px;margin-top:2px;opacity:.75;text-transform:uppercase;letter-spacing:1px}`;

const TEMPLATES: Template[] = [
  {
    id: "minimal",
    label: "⚪ Minimal",
    css: `.card{background:#fff;color:#1f2937;padding:22px 24px}
.bar{position:absolute;left:0;top:0;bottom:0;width:6px;background:#2563eb}
.mono{position:absolute;right:22px;top:20px;width:38px;height:38px;border-radius:50%;border:1.5px solid #2563eb;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.ic{color:#2563eb}.contacts{position:absolute;left:24px;bottom:16px}`,
    body: (c, i) => `<div class="bar"></div><div class="mono">${i}</div>
<div class="name">${esc(c.fullName)}</div><div class="pos">${esc(c.position)}</div><div class="comp">${esc(c.company)}</div>
<div class="contacts">${contactList(c)}</div>`,
  },
  {
    id: "oltin",
    label: "⚫ Qora-oltin",
    css: `.card{background:#111;color:#e5e5e5;padding:22px 24px}
.card:after{content:"";position:absolute;inset:8px;border:1px solid rgba(201,162,75,.45)}
.name{font-family:"Playfair Display",Georgia,serif;color:#c9a24b;font-size:18px}
.pos{color:#e5e5e5}.comp{color:#c9a24b}.ic{color:#c9a24b}
.contacts{position:absolute;right:24px;bottom:18px;text-align:right}.contacts .row{justify-content:flex-end}
.mono{position:absolute;left:24px;bottom:16px;font-family:"Playfair Display",Georgia,serif;font-size:26px;color:#c9a24b;opacity:.9}`,
    body: (c, i) => `<div class="name">${esc(c.fullName)}</div><div class="pos">${esc(c.position)}</div><div class="comp">${esc(c.company)}</div>
<div class="mono">${i}</div><div class="contacts">${contactList(c)}</div>`,
  },
  {
    id: "korporativ",
    label: "🔵 Korporativ",
    css: `.card{background:#fff;color:#0f172a;display:flex}
.left{width:36%;background:#1e3a8a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px}
.mono{width:46px;height:46px;border-radius:10px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px}
.left .comp{color:#fff;opacity:.9;text-align:center;font-size:7.5px}
.right{flex:1;padding:18px 16px;display:flex;flex-direction:column;justify-content:space-between}
.name{font-size:15px}.pos{color:#1e3a8a;font-weight:600}.ic{color:#1e3a8a}`,
    body: (c, i) => `<div class="left"><div class="mono">${i}</div><div class="comp">${esc(c.company)}</div></div>
<div class="right"><div><div class="name">${esc(c.fullName)}</div><div class="pos">${esc(c.position)}</div></div><div>${contactList(c)}</div></div>`,
  },
  {
    id: "yashil",
    label: "🟢 Zamonaviy",
    css: `.card{background:linear-gradient(135deg,#0f766e 0%,#14b8a6 100%);color:#fff;padding:22px 24px}
.card:before{content:"";position:absolute;right:-40px;top:-40px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.1)}
.card:after{content:"";position:absolute;right:30px;bottom:-60px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08)}
.contacts{position:absolute;left:24px;bottom:16px;z-index:1}.comp{opacity:.85}`,
    body: (c) => `<div class="name">${esc(c.fullName)}</div><div class="pos">${esc(c.position)}</div><div class="comp">${esc(c.company)}</div>
<div class="contacts">${contactList(c)}</div>`,
  },
];

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function cardHtml(c: Card, templateId: string | undefined) {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0]!;
  return page(W, H, base + t.css, `<div class="card">${t.body(c, esc(initialsOf(c.fullName)))}</div>`);
}

export const cardService: ServiceDef = {
  id: "card",
  title: "💳 Vizitka",
  cost: 5,
  enabled: true,
  eta: "10-20 soniya",
  steps: [
    { key: "fullName", kind: "text", question: "👤 Vizitkadagi ism-familiya.\n\nMasalan: <i>Vali Aliyev</i>", minLength: 3, maxLength: 60 },
    { key: "position", kind: "text", question: "💼 Lavozim yoki kasb.\n\nMasalan: <i>Bosh dizayner</i>", minLength: 2, maxLength: 60 },
    { key: "company", kind: "text", question: "🏢 Kompaniya nomi (ixtiyoriy).", maxLength: 60, optional: true },
    {
      key: "contacts",
      kind: "text",
      question: "📞 Aloqa ma'lumotlari: telefon, email, sayt, manzil, Telegram (ko'pi bilan 5 ta).\n\nMasalan: <i>+998901234567, vali@gmail.com, @validesign, Toshkent sh.</i>",
      minLength: 5,
      maxLength: 300,
    },
    { key: "template", kind: "choice", question: "🎨 Dizaynni tanlang:", options: TEMPLATES.map((t) => ({ label: t.label, value: t.id })), columns: 2 },
  ],

  async generate(a, deps) {
    const { data, usage } = await deps.gemini.generateJson(
      CardSchema,
      `Ism: ${a.fullName}\nLavozim: ${a.position}\nKompaniya: ${a.company ?? ""}\nAloqa: ${a.contacts}`,
      SYSTEM,
    );
    // 3.125 ≈ 300 dpi: bosmaxonaga berish uchun yetarli aniqlik
    const { png, pdf } = await renderHtml(cardHtml(data, a.template), W, H, 3.125);
    const name = safeFilename(data.fullName, "vizitka");
    return {
      file: pdf,
      filename: `${name} - vizitka.pdf`,
      preview: png,
      extra: [{ file: png, filename: `${name} - vizitka.png` }],
      caption: `✅ Vizitka tayyor: <b>${escapeHtml(data.fullName)}</b>\n\nO'lchami 90×50 mm. PDF'ni bosmaxonaga bersangiz bo'ladi, PNG esa telefonda ulashish uchun.`,
      usage: { ...usage, images: 0 },
    };
  },
};
