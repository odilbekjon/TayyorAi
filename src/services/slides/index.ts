import { safeFilename } from "../../lib/files.js";
import { escapeHtml } from "../../lib/html.js";
import { findPhoto } from "../../lib/photos.js";
import { LANGUAGE_OPTIONS, type ServiceDef } from "../types.js";
import { writeDeck } from "./content.js";
import { renderDeck, type RenderOptions } from "./render.js";
import { THEMES, getTheme } from "./themes.js";

export const slidesService: ServiceDef = {
  id: "slides",
  title: "📊 Slayd (taqdimot)",
  cost: 10,
  enabled: true,
  steps: [
    {
      key: "topic",
      kind: "text",
      question: "📝 Taqdimot mavzusini yozing.\n\nMasalan: <i>Sun'iy intellektning ta'limdagi o'rni</i>",
      minLength: 3,
      maxLength: 200,
    },
    { key: "language", kind: "choice", question: "🌐 Taqdimot qaysi tilda bo'lsin?", options: LANGUAGE_OPTIONS, columns: 2 },
    {
      key: "count",
      kind: "choice",
      question: "🔢 Nechta slayd bo'lsin?",
      options: ["8", "10", "12", "15"].map((n) => ({ label: n, value: n })),
      columns: 4,
    },
    {
      key: "audience",
      kind: "choice",
      question: "👥 Kim uchun?",
      options: [
        { label: "🏫 Maktab", value: "maktab" },
        { label: "🎓 Talaba", value: "talaba" },
        { label: "💼 Ish taqdimoti", value: "ish" },
      ],
      columns: 3,
    },
    {
      key: "theme",
      kind: "choice",
      question: "🎨 Dizaynni tanlang:",
      options: THEMES.map((t) => ({ label: t.label, value: t.id })),
      columns: 2,
    },
    {
      key: "images",
      kind: "choice",
      question: "🖼 Slaydlarda rasm bo'lsinmi?",
      options: [
        { label: "📷 Ha, real fotolar", value: "photo" },
        { label: "🚫 Rasmsiz", value: "none" },
      ],
      columns: 2,
    },
    {
      key: "author",
      kind: "text",
      question: "✍️ Muallif ismi va o'quv yurti/tashkilot (titul slaydga yoziladi).\n\nMasalan: <i>Aliyev Vali, TATU 2-kurs</i>",
      maxLength: 120,
      optional: true,
    },
  ],

  async generate(answers, deps) {
    const { data: deck, usage } = await writeDeck(deps.gemini, answers);

    const images: RenderOptions["images"] = [];
    if (answers.images === "photo") {
      // Ketma-ket: bir xil rasm ikki slaydga tushmasligi uchun
      const used = new Set<string>();
      for (const [i, s] of deck.slides.entries()) {
        await deps.progress?.(`🖼 Rasmlar qidirilmoqda: ${i + 1}/${deck.slides.length}`);
        const photo = await findPhoto(s.imageQuery, { pexelsKey: deps.pexelsKey, used });
        images.push(
          photo
            ? { data: `${photo.mime};base64,${photo.buffer.toString("base64")}`, ratio: photo.width / photo.height, credit: photo.credit }
            : undefined,
        );
      }
    }

    const file = await renderDeck(deck, {
      theme: getTheme(answers.theme),
      author: answers.author,
      language: answers.language ?? "uz_latn",
      images,
    });

    return {
      file,
      filename: `${safeFilename(deck.title, "taqdimot")}.pptx`,
      caption: `✅ Taqdimot tayyor: <b>${escapeHtml(deck.title)}</b>\n${deck.slides.length + 2} ta slayd`,
      usage: { ...usage, images: images.filter(Boolean).length },
    };
  },
};
