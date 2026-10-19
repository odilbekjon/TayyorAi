import { escapeHtml } from "../lib/html.js";

export const texts = {
  welcome: (name: string, credits: number, subscription: string) =>
    `Assalomu alaykum, <b>${escapeHtml(name)}</b>! 👋\n\n` +
    `Men <b>TayyorAI</b>, sizga slayd, rezyume, kurs ishi, vizitka, taklifnoma va boshqa ishlarni bir necha daqiqada tayyorlab beraman.\n\n` +
    `💰 Balans: <b>${credits} kredit</b>\n${subscription}\n\nKerakli xizmatni tanlang:`,
  notAdmin: (id: number) =>
    `⛔ Bu buyruq faqat admin uchun.\nSizning Telegram ID: <code>${id}</code>\n\n` +
    `Admin bo'lish uchun shu raqamni serverdagi ADMIN_IDS sozlamasiga qo'shing.`,
  menu: "Kerakli xizmatni tanlang:",
  balance: (credits: number, prices: string, subscription: string) =>
    `💰 Balansingiz: <b>${credits} kredit</b>\n${subscription}\n\nNarxlar:\n${prices}`,
  subscriptionActive: (until: string, daysLeft: number) =>
    `⭐ Oylik obuna: <b>faol</b>, ${until} gacha (${daysLeft} kun qoldi)`,
  subscriptionNone: (price: number, credits: number, days: number) =>
    `⭐ Oylik obuna: <b>yo'q</b>\n💳 Obuna: ${price.toLocaleString("ru-RU")} so'm = ${credits} kredit, ${days} kun. Ulash uchun admin bilan bog'laning.`,
  subscriptionGranted: (until: string, credits: number, total: number) =>
    `⭐ Oylik obunangiz faollashdi! ${until} gacha amal qiladi.\n🎁 Hisobingizga <b>${credits} kredit</b> qo'shildi, balans: <b>${total} kredit</b>.`,
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
    `😔 Kredit yetarli emas. Kerak: <b>${need}</b>, sizda: <b>${have}</b>.\n\nKredit olish uchun /balans bo'limidagi obunani ko'ring.`,
  creditsAdded: (amount: number, credits: number) =>
    `🎉 Hisobingizga <b>${amount} kredit</b> qo'shildi. Balansingiz: <b>${credits} kredit</b>.`,
  busy: "⏳ Oldingi ishingiz hali tayyorlanmoqda. Iltimos, biroz kuting.",
  working: (eta: string, queued: number) =>
    `⏳ Tayyorlanmoqda... Bu odatda ${eta} oladi.` + (queued > 0 ? `\nNavbatda oldingizda: ${queued} ta ish.` : ""),
  aiBusy: "😔 AI xizmati hozir juda band. Bir necha daqiqadan keyin qayta urinib ko'ring. Kredit yechilmadi.",
  failed: "😔 Xatolik yuz berdi, fayl tayyorlanmadi. Kredit yechilmadi. Iltimos, qayta urinib ko'ring.",
  summaryTitle: "📋 <b>Tekshiring:</b>",
  summaryCost: (cost: number, credits: number) => `\n💰 Narxi: <b>${cost} kredit</b> (balansingiz: ${credits})`,
};
