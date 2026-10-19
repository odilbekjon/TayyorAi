import type { GeminiClient } from "../ai/gemini.js";
import type { PhotoKeys } from "../lib/photos.js";

export interface ChoiceOption {
  label: string;
  value: string;
}

export interface WizardStep {
  key: string;
  question: string;
  kind: "text" | "choice";
  options?: ChoiceOption[];
  /** Tugmalar bir qatorda nechtadan chiqadi */
  columns?: number;
  minLength?: number;
  maxLength?: number;
  /** "O'tkazib yuborish" tugmasi chiqadi */
  optional?: boolean;
}

export type Answers = Record<string, string>;

export interface GenerateDeps {
  gemini: GeminiClient;
  photoKeys?: PhotoKeys;
  /** Uzoq ishlarda foydalanuvchiga holatni ko'rsatish (masalan, "3/9 bo'lim yozilmoqda") */
  progress?: (text: string) => Promise<void>;
}

export interface GenerateResult {
  file: Buffer;
  filename: string;
  caption: string;
  /** Chatda rasm sifatida ko'rinadigan oldindan ko'rish (vizitka, flayer) */
  preview?: Buffer;
  /** Asosiy fayldan keyin yuboriladigan qo'shimcha fayllar (masalan, PNG) */
  extra?: Array<{ file: Buffer; filename: string }>;
  usage: { inputTokens: number; outputTokens: number; images: number };
}

export interface ServiceDef {
  id: string;
  title: string;
  /** Kredit narxi (menyuda ko'rsatiladigan eng past narx) */
  cost: number;
  /** Narx javoblarga bog'liq bo'lsa (masalan, kurs ishi hajmi) */
  costFor?: (answers: Answers) => number;
  /** Kutish vaqti haqida matn, masalan "1-3 daqiqa" */
  eta?: string;
  enabled: boolean;
  steps: WizardStep[];
  generate?: (answers: Answers, deps: GenerateDeps) => Promise<GenerateResult>;
}

export const LANGUAGE_OPTIONS: ChoiceOption[] = [
  { label: "O'zbek (lotin)", value: "uz_latn" },
  { label: "Ўзбек (кирилл)", value: "uz_cyrl" },
  { label: "Русский", value: "ru" },
  { label: "English", value: "en" },
];

export const LANGUAGE_PROMPT: Record<string, string> = {
  uz_latn: "o'zbek tilida, lotin yozuvida",
  uz_cyrl: "o'zbek tilida, kirill yozuvida",
  ru: "rus tilida",
  en: "ingliz tilida",
};

export function costOf(service: ServiceDef, answers: Answers) {
  return service.costFor?.(answers) ?? service.cost;
}
