import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  convertMillimetersToTwip as mm,
} from "docx";
import { buildDocx } from "../../lib/docx.js";
import type { Resume } from "./content.js";

const MARGIN = mm(15);
// A4 kengligi (210 mm) minus ikki tomondagi chekka: sana o'ng chetga tekislanadi
const CONTENT_WIDTH = mm(210) - 2 * MARGIN;

export interface ResumeTemplate {
  id: string;
  label: string;
  accent: string;
  text: string;
  muted: string;
  headingFont: string;
  bodyFont: string;
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  { id: "zamonaviy", label: "🔵 Zamonaviy", accent: "1D4ED8", text: "1F2937", muted: "6B7280", headingFont: "Calibri", bodyFont: "Calibri" },
  { id: "klassik", label: "⚫ Klassik", accent: "111827", text: "1F2937", muted: "4B5563", headingFont: "Georgia", bodyFont: "Georgia" },
  { id: "yashil", label: "🟢 Yashil", accent: "047857", text: "1F2937", muted: "6B7280", headingFont: "Calibri", bodyFont: "Calibri" },
];

const LABELS: Record<string, Record<"summary" | "experience" | "education" | "skills" | "languages", string>> = {
  uz_latn: { summary: "Men haqimda", experience: "Ish tajribasi", education: "Ta'lim", skills: "Ko'nikmalar", languages: "Tillar" },
  uz_cyrl: { summary: "Мен ҳақимда", experience: "Иш тажрибаси", education: "Таълим", skills: "Кўникмалар", languages: "Тиллар" },
  ru: { summary: "О себе", experience: "Опыт работы", education: "Образование", skills: "Навыки", languages: "Языки" },
  en: { summary: "Profile", experience: "Experience", education: "Education", skills: "Skills", languages: "Languages" },
};

export async function renderResume(r: Resume, templateId: string | undefined, language: string) {
  const t = RESUME_TEMPLATES.find((x) => x.id === templateId) ?? RESUME_TEMPLATES[0]!;
  const L = LABELS[language] ?? LABELS.uz_latn!;
  // docx o'lchamlari yarim punktda: 22 = 11 pt
  const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italic?: boolean; heading?: boolean } = {}) =>
    new TextRun({
      text,
      bold: o.bold,
      italics: o.italic,
      size: o.size ?? 22,
      color: o.color ?? t.text,
      font: o.heading ? t.headingFont : t.bodyFont,
    });

  const sectionTitle = (text: string) =>
    new Paragraph({
      spacing: { before: 280, after: 100 },
      border: { bottom: { color: t.accent, style: BorderStyle.SINGLE, size: 8, space: 2 } },
      children: [run(text.toUpperCase(), { bold: true, size: 24, color: t.accent, heading: true })],
    });

  // Chap tomonda nom, o'ng chetda sana
  const row = (left: TextRun[], right: string) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
      spacing: { before: 120, after: 20 },
      children: [...left, new TextRun({ children: [new Tab(), right], size: 20, color: t.muted, font: t.bodyFont })],
    });

  const bullet = (text: string) =>
    new Paragraph({ bullet: { level: 0 }, spacing: { after: 20 }, children: [run(text)] });

  const children: Paragraph[] = [
    new Paragraph({ children: [run(r.fullName, { bold: true, size: 44, color: t.accent, heading: true })] }),
    new Paragraph({ spacing: { after: 60 }, children: [run(r.position, { size: 26, color: t.muted, heading: true })] }),
    new Paragraph({ spacing: { after: 120 }, children: [run(r.contacts.join("  •  "), { size: 20, color: t.muted })] }),
  ];

  if (r.summary) {
    children.push(sectionTitle(L.summary), new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [run(r.summary)] }));
  }

  if (r.experience.length) {
    children.push(sectionTitle(L.experience));
    for (const e of r.experience) {
      children.push(row([run(e.role, { bold: true }), run(`  |  ${e.company}`, { color: t.muted })], e.period));
      children.push(...e.achievements.map(bullet));
    }
  }

  if (r.education.length) {
    children.push(sectionTitle(L.education));
    for (const e of r.education) {
      children.push(row([run(e.institution, { bold: true })], e.period));
      children.push(new Paragraph({ children: [run(e.degree, { color: t.muted })] }));
    }
  }

  if (r.skills.length) {
    children.push(sectionTitle(L.skills), new Paragraph({ children: [run(r.skills.join("  •  "))] }));
  }
  if (r.languages.length) {
    children.push(sectionTitle(L.languages), new Paragraph({ children: [run(r.languages.join("  •  "))] }));
  }

  return buildDocx(r.fullName, [{ children, margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } }]);
}
