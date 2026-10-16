import type { GeminiClient } from "../ai/gemini.js";

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
  pexelsKey?: string;
}

export interface GenerateResult {
  file: Buffer;
  filename: string;
  caption: string;
  usage: { inputTokens: number; outputTokens: number; images: number };
}

export interface ServiceDef {
  id: string;
  title: string;
  /** Kredit narxi */
  cost: number;
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
