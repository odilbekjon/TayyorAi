import { z } from "zod";
import type { GeminiClient } from "../ai/gemini.js";

const ReceiptSchema = z.object({
  isReceipt: z.boolean().describe("Bu bank/to'lov ilovasidagi pul o'tkazmasi cheki yoki skrinshotimi"),
  successful: z.boolean().describe("O'tkazma muvaffaqiyatli bajarilganmi (rad etilgan yoki kutilayotgan emas)"),
  amount: z.number().nullable().describe("O'tkazilgan summa, so'mda (komissiyasiz). Topilmasa null"),
  recipientCardLast4: z.string().nullable().describe("Qabul qiluvchi kartaning oxirgi 4 raqami. Topilmasa null"),
  recipientName: z.string().nullable(),
  date: z.string().nullable().describe("O'tkazma sanasi YYYY-MM-DD formatida. Topilmasa null"),
  transactionId: z.string().nullable().describe("Tranzaksiya/chek raqami. Topilmasa null"),
  suspicious: z.boolean().describe("Rasm tahrirlangan, soxta yoki boshqa joydan olinganga o'xshaydimi"),
  reason: z.string().describe("Qisqa izoh, o'zbek tilida"),
});
export type ReceiptInfo = z.infer<typeof ReceiptSchema>;

const SYSTEM =
  "Sen to'lov cheklarini tekshiruvchisan. Rasmda O'zbekiston bank ilovasi (Payme, Click, Uzum, bank ilovasi va h.k.) " +
  "dagi kartadan kartaga pul o'tkazmasi cheki bormi, aniqla. Faqat rasmda ko'rinadigan ma'lumotni yoz, taxmin qilma.";

export async function readReceipt(gemini: GeminiClient, file: { data: Buffer; mimeType: string }) {
  const { data } = await gemini.generateJson(ReceiptSchema, "Ushbu chekni tekshirib, ma'lumotlarini chiqar.", SYSTEM, {
    file,
    temperature: 0,
  });
  return data;
}

export type ReceiptVerdict =
  | { kind: "reject"; reason: string }
  | { kind: "ok" }
  | { kind: "review"; issues: string[] };

const MAX_AGE_DAYS = 3;

/** AI o'qigan ma'lumotni kutilgan to'lov bilan solishtiradi */
export function judgeReceipt(r: ReceiptInfo, expected: { amount: number; card?: string }, now = new Date()): ReceiptVerdict {
  if (!r.isReceipt) return { kind: "reject", reason: r.reason };

  const issues: string[] = [];
  if (!r.successful) issues.push("o'tkazma muvaffaqiyatli emas");
  if (r.amount === null) issues.push("summa topilmadi");
  else if (r.amount < expected.amount) issues.push(`summa kam: ${r.amount}`);

  const cardLast4 = expected.card?.replace(/\D/g, "").slice(-4);
  const seenLast4 = r.recipientCardLast4?.replace(/\D/g, "").slice(-4);
  if (cardLast4) {
    if (!seenLast4) issues.push("qabul qiluvchi karta ko'rinmadi");
    else if (seenLast4 !== cardLast4) issues.push(`boshqa kartaga o'tkazilgan (*${seenLast4})`);
  }

  const date = r.date ? Date.parse(`${r.date}T12:00:00Z`) : NaN;
  if (Number.isNaN(date)) issues.push("sana topilmadi");
  else if (Math.abs(now.getTime() - date) > MAX_AGE_DAYS * 86_400_000) issues.push(`eski chek: ${r.date}`);

  if (r.suspicious) issues.push(`shubhali: ${r.reason}`);
  return issues.length ? { kind: "review", issues } : { kind: "ok" };
}
