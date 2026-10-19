import { InlineKeyboard } from "grammy";
import { SERVICES } from "../services/registry.js";
import type { WizardStep } from "../services/types.js";

export function mainMenu(admin = false) {
  const kb = new InlineKeyboard();
  SERVICES.forEach((s, i) => {
    kb.text(s.enabled ? s.title : `${s.title} ⏳`, `svc:${s.id}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text("💰 Balans", "balance").text("ℹ️ Yordam", "help");
  if (admin) kb.row().text("📊 Statistika", "admin:stat").text("👥 Foydalanuvchilar", "admin:users");
  return kb;
}

export function stepKeyboard(step: WizardStep, stepIndex: number) {
  const kb = new InlineKeyboard();
  const cols = step.columns ?? 1;
  step.options?.forEach((o, i) => {
    kb.text(o.label, `w:${stepIndex}:${i}`);
    if ((i + 1) % cols === 0) kb.row();
  });
  if (step.optional) kb.row().text("⏭ O'tkazib yuborish", `w:${stepIndex}:skip`);
  return kb.row().text("❌ Bekor qilish", "w:cancel");
}

export function confirmKeyboard() {
  return new InlineKeyboard().text("✅ Tayyorlash", "w:confirm").text("❌ Bekor qilish", "w:cancel");
}

export function backToMenu() {
  return new InlineKeyboard().text("🏠 Bosh menyu", "menu");
}

export function buyKeyboard() {
  return new InlineKeyboard().text("💳 Obuna sotib olish", "pay:start").row().text("🏠 Bosh menyu", "menu");
}

export function paymentDecisionKeyboard(paymentId: string) {
  return new InlineKeyboard().text("✅ Tasdiqlash", `pay:ok:${paymentId}`).text("❌ Rad etish", `pay:no:${paymentId}`);
}

export function paymentRevokeKeyboard(paymentId: string) {
  return new InlineKeyboard().text("↩️ Pul tushmagan, qaytarib olish", `pay:rev:${paymentId}`);
}
