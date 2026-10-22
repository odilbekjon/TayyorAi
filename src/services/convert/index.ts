import { zipSync } from "fflate";
import { imageMime, officeToPdf, pdfPageCount, pdfToDocx, pdfToImages } from "../../lib/convert.js";
import { safeFilename } from "../../lib/files.js";
import { htmlToPdf } from "../../lib/html-render.js";
import { escapeHtml } from "../../lib/html.js";
import { filesOf, type FileAccept, type GenerateResult, type ServiceDef, type UploadedFile } from "../types.js";

const OFFICE = {
  word: [".docx", ".doc", ".odt", ".rtf"],
  excel: [".xlsx", ".xls", ".ods"],
  powerpoint: [".pptx", ".ppt", ".odp"],
};
const IMAGES = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"];
/** PDF → rasm: shundan ko'p sahifa bo'lsa ZIP qilib yuboriladi */
const MAX_SEPARATE_IMAGES = 10;
const MAX_PDF_PAGES = 50;
const MAX_IMAGES = 30;

interface Mode {
  label: string;
  accept: FileAccept;
}

const MODES: Record<string, Mode> = {
  word2pdf: {
    label: "📝 Word → PDF",
    accept: { extensions: OFFICE.word, question: "📎 Word faylni yuboring (.docx, .doc, .odt, .rtf)." },
  },
  pdf2word: {
    label: "📄 PDF → Word",
    accept: {
      extensions: [".pdf"],
      question: "📎 PDF faylni yuboring.\n\n<i>Skaner qilingan (rasm ko'rinishidagi) PDF'da matn tahrirlanadigan bo'lmaydi.</i>",
    },
  },
  img2pdf: {
    label: "🖼 Rasm → PDF",
    accept: {
      extensions: IMAGES,
      photos: true,
      maxFiles: MAX_IMAGES,
      question:
        `📎 Rasmlarni yuboring (ko'pi bilan ${MAX_IMAGES} ta). Har bir rasm PDF'ning alohida sahifasi bo'ladi, ` +
        `yuborgan tartibingizda.\n\nHammasini yuborgach "Tayyor" tugmasini bosing.`,
    },
  },
  pdf2img: {
    label: "🖼 PDF → Rasm",
    accept: {
      extensions: [".pdf"],
      question: `📎 PDF faylni yuboring. Har bir sahifa alohida JPG rasm bo'ladi (ko'pi bilan ${MAX_PDF_PAGES} sahifa).`,
    },
  },
  ppt2pdf: {
    label: "📊 PowerPoint → PDF",
    accept: { extensions: OFFICE.powerpoint, question: "📎 Taqdimot faylini yuboring (.pptx, .ppt, .odp)." },
  },
  excel2pdf: {
    label: "📈 Excel → PDF",
    accept: { extensions: OFFICE.excel, question: "📎 Excel faylni yuboring (.xlsx, .xls, .ods)." },
  },
};

const baseName = (f: UploadedFile) => safeFilename(f.name.replace(/\.[^.]+$/, ""), "fayl");
const extOf = (f: UploadedFile) => f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
const noUsage = { inputTokens: 0, outputTokens: 0, images: 0 };

/** Har bir rasm A4 sahifaning o'rtasiga, nisbatini saqlagan holda joylashadi */
function imagesHtml(images: Buffer[]) {
  const pages = images
    .map((img) => `<div class="p"><img src="data:${imageMime(img) ?? "image/jpeg"};base64,${img.toString("base64")}"></div>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}
.p{width:210mm;height:297mm;padding:10mm;box-sizing:border-box;display:flex;align-items:center;justify-content:center;break-after:page;overflow:hidden}
.p:last-child{break-after:auto}
img{max-width:100%;max-height:100%;object-fit:contain}
</style></head><body>${pages}</body></html>`;
}

async function convert(mode: string, files: UploadedFile[], download: (id: string) => Promise<Buffer>): Promise<GenerateResult> {
  const first = files[0];
  if (!first) throw new Error("Fayl yuborilmagan");
  const name = baseName(first);

  if (mode === "img2pdf") {
    const images = await Promise.all(files.map((f) => download(f.fileId)));
    const file = await htmlToPdf(imagesHtml(images), { width: "210mm", height: "297mm" });
    return {
      file,
      filename: `${files.length > 1 ? "rasmlar" : name}.pdf`,
      caption: `✅ PDF tayyor: <b>${images.length}</b> ta sahifa.`,
      usage: noUsage,
    };
  }

  const input = await download(first.fileId);
  if (mode === "pdf2word") {
    return {
      file: await pdfToDocx(input),
      filename: `${name}.docx`,
      caption: `✅ Word fayl tayyor: <b>${escapeHtml(name)}.docx</b>\n\nMurakkab sahifalarda joylashuv biroz farq qilishi mumkin, tekshirib chiqing.`,
      usage: noUsage,
    };
  }

  if (mode === "pdf2img") {
    const total = await pdfPageCount(input).catch(() => 0);
    const images = await pdfToImages(input, MAX_PDF_PAGES);
    const note = total > images.length ? `\n\n⚠️ PDF'da ${total} sahifa bor, birinchi ${images.length} tasi rasmga aylantirildi.` : "";
    const pageName = (i: number) => `${name}-${String(i + 1).padStart(2, "0")}.jpg`;
    if (images.length > MAX_SEPARATE_IMAGES) {
      const zip = zipSync(Object.fromEntries(images.map((img, i) => [pageName(i), img])), { level: 0 });
      return {
        file: Buffer.from(zip),
        filename: `${name}-rasmlar.zip`,
        preview: images[0],
        caption: `✅ ${images.length} ta sahifa rasmga aylantirildi va ZIP arxivga joylandi.${note}`,
        usage: noUsage,
      };
    }
    // 10 tagacha sahifa: har biri alohida fayl, oxirgisi izoh bilan birga
    const last = images.length - 1;
    return {
      file: images[last]!,
      filename: pageName(last),
      extra: images.slice(0, last).map((img, i) => ({ file: img, filename: pageName(i) })),
      caption: `✅ ${images.length} ta sahifa rasmga aylantirildi.${note}`,
      usage: noUsage,
    };
  }

  const file = await officeToPdf(input, extOf(first));
  return {
    file,
    filename: `${name}.pdf`,
    caption: `✅ PDF tayyor: <b>${escapeHtml(name)}.pdf</b>`,
    usage: noUsage,
  };
}

export const convertService: ServiceDef = {
  id: "convert",
  title: "🔄 Format o'zgartirish",
  cost: 2,
  enabled: true,
  local: true,
  eta: "10-40 soniya",
  steps: [
    {
      key: "mode",
      kind: "choice",
      question: "🔄 Qaysi formatdan qaysi formatga o'zgartiramiz?",
      options: Object.entries(MODES).map(([value, m]) => ({ label: m.label, value })),
      columns: 2,
    },
    {
      key: "files",
      kind: "file",
      question: "📎 Faylni yuboring.",
      accept: (a) => MODES[a.mode ?? ""]?.accept ?? { extensions: [] },
    },
  ],

  generate: (a, deps) => convert(a.mode ?? "", filesOf(a, "files"), deps.download),
};
