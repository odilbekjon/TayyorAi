import pptxgen from "pptxgenjs";
import type { Deck } from "./content.js";
import type { SlideTheme } from "./themes.js";

// pptxgenjs tiplari CJS ko'rinishida, runtime esa ESM build'ni yuklaydi:
// default eksport aynan klassning o'zi bo'ladi.
const PptxGenJS = pptxgen as unknown as typeof pptxgen.default;

export interface RenderOptions {
  theme: SlideTheme;
  author?: string;
  language: string;
  /** Har bir slayd uchun rasm (index bo'yicha): pptxgenjs formatidagi base64 va manba yozuvi */
  images: Array<{ data: string; ratio: number; credit: string } | undefined>;
}

const THANKS: Record<string, string> = {
  uz_latn: "E'tiboringiz uchun rahmat!",
  uz_cyrl: "Эътиборингиз учун раҳмат!",
  ru: "Спасибо за внимание!",
  en: "Thank you for your attention!",
};

// LAYOUT_WIDE: 13.333 x 7.5 dyuym
const W = 13.333;
const H = 7.5;

export async function renderDeck(deck: Deck, opts: RenderOptions): Promise<Buffer> {
  const { theme } = opts;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;
  if (opts.author) pptx.author = opts.author;

  // Titul slayd
  const cover = pptx.addSlide();
  cover.background = { color: theme.background };
  cover.addShape("rect", { x: 0, y: 0, w: 0.35, h: H, fill: { color: theme.accent } });
  cover.addShape("rect", { x: 0.9, y: 4.35, w: 1.6, h: 0.08, fill: { color: theme.accent } });
  cover.addText(deck.title, {
    x: 0.9, y: 1.4, w: W - 1.8, h: 2.8,
    fontFace: theme.headingFont, fontSize: 40, bold: true, color: theme.title,
    valign: "bottom", fit: "shrink",
  });
  cover.addText(deck.subtitle, {
    x: 0.9, y: 4.6, w: W - 1.8, h: 1.0,
    fontFace: theme.bodyFont, fontSize: 20, color: theme.text, valign: "top",
  });
  if (opts.author) {
    cover.addText(opts.author, {
      x: 0.9, y: H - 1.2, w: W - 1.8, h: 0.5,
      fontFace: theme.bodyFont, fontSize: 14, color: theme.text, italic: true,
    });
  }

  // Mazmunli slaydlar
  deck.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: theme.background };
    const image = opts.images[i];
    const textW = image ? 6.9 : W - 1.6;

    slide.addText(s.title, {
      x: 0.8, y: 0.45, w: W - 1.6, h: 1.0,
      fontFace: theme.headingFont, fontSize: 28, bold: true, color: theme.title,
      valign: "middle", fit: "shrink",
    });
    slide.addShape("rect", { x: 0.8, y: 1.5, w: 1.1, h: 0.07, fill: { color: theme.accent } });

    slide.addText(
      s.bullets.map((b) => ({
        text: b,
        options: { bullet: { code: "25A0" }, paraSpaceAfter: 10 },
      })),
      {
        x: 0.8, y: 1.85, w: textW, h: H - 2.6,
        fontFace: theme.bodyFont, fontSize: 20, color: theme.text,
        valign: "top", fit: "shrink",
      },
    );

    if (image) {
      slide.addShape("rect", { x: 8.05, y: 1.75, w: 4.6, h: 4.9, fill: { color: theme.surface } });
      // pptxgenjs "cover" uchun w/h rasmning o'z nisbatida bo'lishi kerak, aks holda rasm cho'ziladi
      const box = { w: 4.3, h: 4.6 };
      const size = image.ratio > box.w / box.h ? { w: box.h * image.ratio, h: box.h } : { w: box.w, h: box.w / image.ratio };
      slide.addImage({ data: image.data, x: 8.2, y: 1.9, ...size, sizing: { type: "cover", ...box } });
      slide.addText(image.credit, {
        x: 8.05, y: 6.62, w: 4.6, h: 0.28,
        fontFace: theme.bodyFont, fontSize: 8, color: theme.text, italic: true, align: "right",
      });
    }

    slide.addText(String(i + 2), {
      x: W - 1.3, y: H - 0.6, w: 0.8, h: 0.4,
      fontFace: theme.bodyFont, fontSize: 11, color: theme.text, align: "right",
    });
  });

  // Yakuniy slayd
  const end = pptx.addSlide();
  end.background = { color: theme.accent };
  end.addText(THANKS[opts.language] ?? THANKS.uz_latn!, {
    x: 0.8, y: 2.0, w: W - 1.6, h: 1.4,
    fontFace: theme.headingFont, fontSize: 40, bold: true, color: theme.onAccent, align: "center",
  });
  end.addText(deck.conclusion, {
    x: 1.5, y: 3.6, w: W - 3.0, h: 1.6,
    fontFace: theme.bodyFont, fontSize: 18, color: theme.onAccent, align: "center", valign: "top",
  });

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
