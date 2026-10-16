export interface SlideTheme {
  id: string;
  label: string;
  background: string;
  surface: string;
  accent: string;
  /** Accent fonidagi matn rangi (kontrast uchun) */
  onAccent: string;
  title: string;
  text: string;
  headingFont: string;
  bodyFont: string;
}

/** Ranglar pptxgenjs talabi bo'yicha '#' belgisisiz yoziladi. */
export const THEMES: SlideTheme[] = [
  {
    id: "zamonaviy",
    label: "🔵 Zamonaviy",
    background: "FFFFFF",
    surface: "EEF2FF",
    accent: "4F46E5",
    onAccent: "FFFFFF",
    title: "1E1B4B",
    text: "334155",
    headingFont: "Montserrat",
    bodyFont: "Calibri",
  },
  {
    id: "tungi",
    label: "🌙 Tungi",
    background: "0F172A",
    surface: "1E293B",
    accent: "38BDF8",
    onAccent: "0F172A",
    title: "F8FAFC",
    text: "CBD5E1",
    headingFont: "Montserrat",
    bodyFont: "Calibri",
  },
  {
    id: "tabiat",
    label: "🌿 Tabiat",
    background: "F7FBF4",
    surface: "E3F1DA",
    accent: "2F7D32",
    onAccent: "FFFFFF",
    title: "1B3A1D",
    text: "3F4F3F",
    headingFont: "Georgia",
    bodyFont: "Calibri",
  },
  {
    id: "milliy",
    label: "🟡 Milliy",
    background: "FFFBF2",
    surface: "F6E7C8",
    accent: "1D4E89",
    onAccent: "FFFFFF",
    title: "7A2E0E",
    text: "4A3B2A",
    headingFont: "Georgia",
    bodyFont: "Calibri",
  },
];

export function getTheme(id: string | undefined): SlideTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
