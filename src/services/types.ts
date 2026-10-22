import type { GeminiClient } from "../ai/gemini.js";
import type { PhotoKeys } from "../lib/photos.js";

export interface ChoiceOption {
  label: string;
  value: string;
}

export interface WizardStep {
  key: string;
  question: string;
  kind: "text" | "choice" | "file";
  options?: ChoiceOption[];
  /** Tugmalar bir qatorda nechtadan chiqadi */
  columns?: number;
  minLength?: number;
  maxLength?: number;
  /** "O'tkazib yuborish" tugmasi chiqadi */
  optional?: boolean;
  /** Matnli javobni qo'shimcha tekshirish: xato bo'lsa foydalanuvchiga ko'rsatiladigan matn */
  validate?: (value: string) => string | undefined;
  /** kind = "file": qabul qilinadigan fayl turi (javoblarga qarab o'zgarishi mumkin) */
  accept?: (answers: Answers) => FileAccept;
}

export interface FileAccept {
  /** Ruxsat etilgan kengaytmalar, masalan [".docx", ".doc"] */
  extensions: string[];
  /** Telegram'ning siqilgan rasmini (photo) ham qabul qiladi */
  photos?: boolean;
  /** Bir nechta fayl yig'iladi va "Tayyor" tugmasi chiqadi */
  maxFiles?: number;
  /** Savol matni o'rniga ko'rsatiladigan izoh */
  question?: string;
}

/** Foydalanuvchi yuborgan fayl: javoblarda JSON ro'yxat sifatida saqlanadi */
export interface UploadedFile {
  fileId: string;
  name: string;
  size?: number;
}

export type Answers = Record<string, string>;

export interface GenerateDeps {
  gemini: GeminiClient;
  /** Foydalanuvchi yuborgan faylni Telegram'dan yuklab oladi */
  download: (fileId: string) => Promise<Buffer>;
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
  /** AI ishlatmaydi: Gemini navbatini band qilmaydi (masalan, format o'zgartirish) */
  local?: boolean;
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

export function filesOf(answers: Answers, key: string): UploadedFile[] {
  try {
    return JSON.parse(answers[key] ?? "[]") as UploadedFile[];
  } catch {
    return [];
  }
}
