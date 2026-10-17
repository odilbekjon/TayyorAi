import {
  AlignmentType,
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
  convertMillimetersToTwip as mm,
  type IParagraphOptions,
  type ISectionOptions,
} from "docx";

/**
 * O'zbekistondagi rasmiy va akademik hujjatlar uchun odatiy talablar:
 * Times New Roman 14, 1.5 interval, chap 30 mm, o'ng 15 mm, yuqori/past 20 mm.
 */
export const FONT = "Times New Roman";
export const SIZE = 28; // yarim punktlarda: 28 = 14 pt
const LINE_15 = 360; // 1.5 interval (240 = 1.0)

export const PAGE_MARGINS = { top: mm(20), bottom: mm(20), left: mm(30), right: mm(15) };

export function para(text: string, opts: Omit<IParagraphOptions, "children" | "text"> & { bold?: boolean; size?: number; italic?: boolean } = {}) {
  const { bold, size, italic, ...rest } = opts;
  return new Paragraph({
    spacing: { line: LINE_15, after: 0 },
    ...rest,
    children: [new TextRun({ text, bold, italics: italic, size: size ?? SIZE, font: FONT })],
  });
}

/** Asosiy matn xatboshisi: kenglik bo'yicha tekislangan, 1.25 sm xat boshi. */
export function body(text: string) {
  return para(text, { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: mm(12.5) } });
}

export function heading(text: string, level: 1 | 2, pageBreakBefore = false) {
  return para(level === 1 ? text.toUpperCase() : text, {
    bold: true,
    alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
    indent: level === 2 ? { firstLine: mm(12.5) } : undefined,
    spacing: { line: LINE_15, before: level === 1 ? 0 : 240, after: 120 },
    pageBreakBefore,
  });
}

export function empty(count = 1) {
  return Array.from({ length: count }, () => para(""));
}

export function pageNumberFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })],
      }),
    ],
  });
}

export async function buildDocx(
  title: string,
  sections: Array<Pick<ISectionOptions, "children" | "footers"> & { margins?: typeof PAGE_MARGINS; titlePage?: boolean }>,
) {
  const doc = new Document({
    title,
    creator: "TayyorAI",
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: sections.map((s) => ({
      properties: { titlePage: s.titlePage, page: { margin: s.margins ?? PAGE_MARGINS } },
      footers: s.footers,
      children: s.children,
    })),
  });
  return Packer.toBuffer(doc);
}
