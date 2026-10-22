import { escapeHtml } from "../lib/html.js";

export const texts = {
  welcome: (name: string, credits: string, subscription: string) =>
    `Assalomu alaykum, <b>${escapeHtml(name)}</b>! 👋\n\n` +
    `Men <b>TayyorAI</b>, sizga slayd, rezyume, kurs ishi, test, sertifikat, vizitka, taklifnoma va boshqa ishlarni bir necha daqiqada tayyorlab beraman. Fayl formatini ham o'zgartiraman (Word ↔ PDF, rasm ↔ PDF).\n\n` +
    `💰 Balans: <b>${credits}</b>\n${subscription}\n\nKerakli xizmatni tanlang:`,
  notAdmin: (id: number) =>
    `⛔ Bu buyruq faqat admin uchun.\nSizning Telegram ID: <code>${id}</code>\n\n` +
    `Admin bo'lish uchun shu raqamni serverdagi ADMIN_IDS sozlamasiga qo'shing.`,
  menu: "Kerakli xizmatni tanlang:",
  balance: (credits: string, prices: string, subscription: string) =>
    `💰 Balansingiz: <b>${credits}</b>\n${subscription}\n\nNarxlar:\n${prices}`,
  subscriptionActive: (until: string, daysLeft: number) =>
    `⭐ Oylik obuna: <b>faol</b>, ${until} gacha (${daysLeft} kun qoldi)`,
  subscriptionNone: (price: number, credits: number, days: number) =>
    `⭐ Oylik obuna: <b>yo'q</b>\n💳 Obuna: ${price.toLocaleString("ru-RU")} so'm = ${credits} kredit, ${days} kun.`,
  subscriptionGranted: (until: string, credits: number, total: number) =>
    `⭐ Oylik obunangiz faollashdi! ${until} gacha amal qiladi.\n🎁 Hisobingizga <b>${credits} kredit</b> qo'shildi, balans: <b>${total} kredit</b>.`,
  help:
    `ℹ️ <b>Qanday ishlaydi?</b>\n\n` +
    `1. Menyudan xizmatni tanlang.\n2. Bot bergan savollarga javob bering.\n3. Tasdiqlang va tayyor faylni oling.\n\n` +
    `Kredit faqat fayl muvaffaqiyatli tayyorlangandan keyin yechiladi.\n\n` +
    `Buyruqlar: /start, /menu, /balans, /tolov, /bekor`,
  soon: "⏳ Bu xizmat tez orada qo'shiladi!",
  cancelled: "❌ Bekor qilindi.",
  noWizard: "Xizmatni menyudan tanlang 👇",
  useButtons: "👆 Iltimos, yuqoridagi tugmalardan birini tanlang.",
  tooShort: (n: number) => `Juda qisqa. Kamida ${n} ta belgi yozing.`,
  tooLong: (n: number) => `Juda uzun. Ko'pi bilan ${n} ta belgi yozing.`,
  sendFile: "📎 Iltimos, faylni shu chatga yuboring.",
  wrongFile: (formats: string) => `😔 Bu fayl turi mos emas. Quyidagilardan birini yuboring: <b>${escapeHtml(formats)}</b>`,
  fileTooBig: (mb: number) => `😔 Fayl juda katta. Telegram botlari ${mb} MB gacha bo'lgan faylni qabul qiladi.`,
  filesReceived: (count: number, max: number) =>
    `✅ ${count} ta fayl qabul qilindi (ko'pi bilan ${max} ta).\n\nYana yuboring yoki "Tayyor" tugmasini bosing.`,
  tooManyFiles: (max: number) => `⚠️ Ko'pi bilan ${max} ta fayl yuborish mumkin. "Tayyor" tugmasini bosing.`,
  notEnoughCredits: (need: number, have: number) =>
    `😔 Kredit yetarli emas. Kerak: <b>${need}</b>, sizda: <b>${have}</b>.\n\nObuna sotib olib, kredit oling 👇`,
  payInstructions: (price: number, credits: number, days: number, card: string, holder?: string) =>
    `💳 <b>Oylik obuna</b>: ${price.toLocaleString("ru-RU")} so'm = <b>${credits} kredit</b>, ${days} kun\n\n` +
    `1. Quyidagi kartaga <b>${price.toLocaleString("ru-RU")} so'm</b> o'tkazing:\n` +
    `<code>${escapeHtml(card)}</code>` + (holder ? `\n${escapeHtml(holder)}` : "") + `\n\n` +
    `2. To'lov chekining <b>skrinshotini</b> shu chatga yuboring.\n\n` +
    `Admin tekshirgach obuna avtomatik faollashadi va sizga xabar keladi.`,
  payUnavailable: "💳 To'lov hozircha sozlanmagan. Iltimos, admin bilan bog'laning.",
  payPending: "⏳ Oldingi chekingiz hali tekshirilmoqda. Admin tasdiqlagach xabar keladi.",
  payReceived: "✅ Chek qabul qilindi! Admin tekshirgach obunangiz faollashadi va sizga xabar keladi.",
  payChecking: "🔎 Chek tekshirilmoqda...",
  payNotReceipt: (reason: string) =>
    `😔 Bu rasm to'lov chekiga o'xshamaydi (${escapeHtml(reason)}).\n\n` +
    `Iltimos, bank ilovasidagi o'tkazma chekining skrinshotini yuboring.`,
  payDuplicate: "⚠️ Bu chek avval yuborilgan. Iltimos, yangi to'lov chekini yuboring.",
  payRejected: "😔 To'lovingiz tasdiqlanmadi. Savol bo'lsa, admin bilan bog'laning.",
  payRevoked: "😔 Admin chekingizni tekshirib, to'lovni tasdiqlamadi. Obuna va kredit qaytarib olindi. Savol bo'lsa, admin bilan bog'laning.",
  payAdmin: (name: string, id: number, username: string | undefined, amount: number, note: string) =>
    `💳 <b>Yangi to'lov cheki</b>\n\n👤 ${escapeHtml(name)}${username ? ` @${escapeHtml(username)}` : ""}\n` +
    `🆔 <code>${id}</code>\n💰 ${amount.toLocaleString("ru-RU")} so'm\n\n${note}`,
  creditsAdded: (amount: number, credits: number) =>
    `🎉 Hisobingizga <b>${amount} kredit</b> qo'shildi. Balansingiz: <b>${credits} kredit</b>.`,
  busy: "⏳ Oldingi ishingiz hali tayyorlanmoqda. Iltimos, biroz kuting.",
  working: (eta: string, queued: number) =>
    `⏳ Tayyorlanmoqda... Bu odatda ${eta} oladi.` + (queued > 0 ? `\nNavbatda oldingizda: ${queued} ta ish.` : ""),
  aiBusy: "😔 AI xizmati hozir juda band. Bir necha daqiqadan keyin qayta urinib ko'ring. Kredit yechilmadi.",
  failed: "😔 Xatolik yuz berdi, fayl tayyorlanmadi. Kredit yechilmadi. Iltimos, qayta urinib ko'ring.",
  summaryTitle: "📋 <b>Tekshiring:</b>",
  summaryCost: (cost: number, credits: number) => `\n💰 Narxi: <b>${cost} kredit</b> (balansingiz: ${credits})`,
  summaryCostAdmin: (cost: number) => `\n💰 Narxi: ${cost} kredit, siz admin bo'lganingiz uchun <b>bepul</b>`,
  adminCredits: "♾ Cheksiz (admin)",
};
