import { escapeHtml } from "../lib/html.js";

export const texts = {
  welcome: (name: string, credits: number) =>
    `Assalomu alaykum, <b>${escapeHtml(name)}</b>! 👋\n\n` +
    `Men <b>TayyorAI</b>, sizga slayd, rezyume, kurs ishi, vizitka, taklifnoma va boshqa ishlarni bir necha daqiqada tayyorlab beraman.\n\n` +
    `🎁 Sizda <b>${credits} kredit</b> bor. Kerakli xizmatni tanlang:`,
  menu: "Kerakli xizmatni tanlang:",
  balance: (credits: number, prices: string) =>
    `💰 Balansingiz: <b>${credits} kredit</b>\n\nNarxlar:\n${prices}\n\n` +
    `💳 Obuna (10 000 so'm = 100 kredit) tez orada ishga tushadi.`,
  help:
    `ℹ️ <b>Qanday ishlaydi?</b>\n\n` +
    `1. Menyudan xizmatni tanlang.\n2. Bot bergan savollarga javob bering.\n3. Tasdiqlang va tayyor faylni oling.\n\n` +
    `Kredit faqat fayl muvaffaqiyatli tayyorlangandan keyin yechiladi.\n\n` +
    `Buyruqlar: /start, /menu, /balans, /bekor`,
  soon: "⏳ Bu xizmat tez orada qo'shiladi!",
  cancelled: "❌ Bekor qilindi.",
  noWizard: "Xizmatni menyudan tanlang 👇",
  useButtons: "👆 Iltimos, yuqoridagi tugmalardan birini tanlang.",
  tooShort: (n: number) => `Juda qisqa. Kamida ${n} ta belgi yozing.`,
  tooLong: (n: number) => `Juda uzun. Ko'pi bilan ${n} ta belgi yozing.`,
  notEnoughCredits: (need: number, have: number) =>
    `😔 Kredit yetarli emas. Kerak: <b>${need}</b>, sizda: <b>${have}</b>.\n\nObuna tez orada ishga tushadi.`,
  busy: "⏳ Oldingi ishingiz hali tayyorlanmoqda. Iltimos, biroz kuting.",
  working: (queued: number) =>
    `⏳ Tayyorlanmoqda... Bu odatda 20-60 soniya oladi.` + (queued > 0 ? `\nNavbatda oldingizda: ${queued} ta ish.` : ""),
  aiBusy: "😔 AI xizmati hozir juda band. Bir necha daqiqadan keyin qayta urinib ko'ring. Kredit yechilmadi.",
  failed: "😔 Xatolik yuz berdi, fayl tayyorlanmadi. Kredit yechilmadi. Iltimos, qayta urinib ko'ring.",
  summaryTitle: "📋 <b>Tekshiring:</b>",
  summaryCost: (cost: number, credits: number) => `\n💰 Narxi: <b>${cost} kredit</b> (balansingiz: ${credits})`,
};
