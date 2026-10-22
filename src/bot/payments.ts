import type { Bot, Context } from "grammy";
import type { Config } from "../config.js";
import { Payment, User } from "../db/models.js";
import { decidePayment, hasBadPaymentHistory, hasPendingPayment, isDuplicateReceipt, revokePayment } from "../db/payments.js";
import { formatTashkent } from "../db/stats.js";
import { grantSubscription, revokeSubscription } from "../db/users.js";
import type { GeminiClient } from "../ai/gemini.js";
import { escapeHtml } from "../lib/html.js";
import { judgeReceipt, readReceipt, type ReceiptInfo, type ReceiptVerdict } from "../lib/receipt.js";
import { downloadTelegramFile } from "../lib/telegram.js";
import { backToMenu, paymentDecisionKeyboard, paymentRevokeKeyboard } from "./keyboards.js";
import { texts } from "./texts.js";

/** "Obuna sotib olish" bosilgandan keyin chek shu vaqt ichida qabul qilinadi */
const RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface PaymentDeps {
  config: Config;
  gemini: GeminiClient;
  isAdmin: (ctx: Context) => boolean;
}

/**
 * Karta orqali to'lov: foydalanuvchi kartaga pul o'tkazib chek yuboradi. Chekni AI o'qiydi:
 * chek bo'lmasa rad etiladi, hammasi mos kelsa obuna darhol beriladi (admin keyin qaytarib
 * olishi mumkin), shubhali bo'lsa admin tasdiqlashini kutadi.
 */
export function registerPayments(bot: Bot, { config, gemini, isAdmin }: PaymentDeps) {
  const html = { parse_mode: "HTML" as const };

  const startPayment = async (ctx: Context) => {
    if (!config.PAYMENT_CARD) return ctx.reply(texts.payUnavailable, { reply_markup: backToMenu() });
    if (await hasPendingPayment(ctx.from!.id)) return ctx.reply(texts.payPending, { reply_markup: backToMenu() });
    await User.updateOne({ telegramId: ctx.from!.id }, { $set: { awaitingReceiptAt: new Date() } });
    await ctx.reply(
      texts.payInstructions(
        config.SUBSCRIPTION_PRICE, config.SUBSCRIPTION_CREDITS, config.SUBSCRIPTION_DAYS,
        config.PAYMENT_CARD, config.PAYMENT_CARD_HOLDER,
      ),
      { ...html, reply_markup: backToMenu() },
    );
  };
  bot.command(["obunaolish", "tolov"], startPayment);
  bot.callbackQuery("pay:start", async (ctx) => {
    await ctx.answerCallbackQuery();
    await startPayment(ctx);
  });

  async function notifyAdmins(ctx: Context, fileKind: "photo" | "document", fileId: string, caption: string, reply_markup: ReturnType<typeof paymentDecisionKeyboard>) {
    const options = { caption, ...html, reply_markup };
    for (const adminId of config.ADMIN_IDS) {
      const send = fileKind === "photo" ? ctx.api.sendPhoto(adminId, fileId, options) : ctx.api.sendDocument(adminId, fileId, options);
      await send.catch((err) => console.error(`[pay] admin ${adminId} ga chek yuborilmadi:`, err.description ?? err));
    }
  }

  // Chek: rasm yoki fayl (skrinshot, PDF)
  bot.on(["message:photo", "message:document"], async (ctx, next) => {
    const since = new Date(Date.now() - RECEIPT_WINDOW_MS);
    // Atomik: bir chek ikki marta yozilib qolmasin
    const user = await User.findOneAndUpdate(
      { telegramId: ctx.from.id, awaitingReceiptAt: { $gte: since } },
      { $unset: { awaitingReceiptAt: 1 } },
    );
    if (!user) return next();
    const waitAgain = () => User.updateOne({ telegramId: ctx.from.id }, { $set: { awaitingReceiptAt: new Date() } });

    const photo = ctx.message.photo?.at(-1);
    const doc = ctx.message.document;
    const fileId = photo?.file_id ?? doc!.file_id;
    const fileUniqueId = photo?.file_unique_id ?? doc!.file_unique_id;
    const fileKind: "photo" | "document" = photo ? "photo" : "document";
    const mimeType = photo ? "image/jpeg" : doc!.mime_type ?? "";
    if (!/^image\/|^application\/pdf$/.test(mimeType)) {
      await waitAgain();
      return ctx.reply(texts.payNotReceipt("rasm yoki PDF emas"), html);
    }
    if (await isDuplicateReceipt(fileUniqueId)) {
      await waitAgain();
      return ctx.reply(texts.payDuplicate);
    }

    const checking = await ctx.reply(texts.payChecking);
    let receipt: ReceiptInfo | null = null;
    let verdict: ReceiptVerdict;
    try {
      receipt = await readReceipt(gemini, { data: await downloadTelegramFile(ctx.api, config.BOT_TOKEN, fileId), mimeType });
      verdict = judgeReceipt(receipt, { amount: config.SUBSCRIPTION_PRICE, card: config.PAYMENT_CARD });
    } catch (err) {
      // AI ishlamasa, chekni admin o'zi ko'radi
      console.error("[pay] chekni AI tekshira olmadi:", err);
      verdict = { kind: "review", issues: ["AI tekshira olmadi"] };
    }
    await ctx.api.deleteMessage(checking.chat.id, checking.message_id).catch(() => undefined);

    const base = {
      telegramId: ctx.from.id,
      amount: config.SUBSCRIPTION_PRICE,
      credits: config.SUBSCRIPTION_CREDITS,
      days: config.SUBSCRIPTION_DAYS,
      fileId, fileKind, fileUniqueId,
      transactionId: receipt?.transactionId ?? undefined,
      ai: receipt ?? undefined,
    };

    if (verdict.kind === "reject") {
      await Payment.create({ ...base, status: "rejected" });
      await waitAgain();
      return ctx.reply(texts.payNotReceipt(verdict.reason), html);
    }
    if (receipt?.transactionId && (await isDuplicateReceipt(fileUniqueId, receipt.transactionId))) {
      await Payment.create({ ...base, transactionId: undefined, status: "rejected" });
      await waitAgain();
      return ctx.reply(texts.payDuplicate);
    }

    const summary = receipt
      ? `🤖 AI: ${receipt.amount?.toLocaleString("ru-RU") ?? "?"} so'm, karta *${receipt.recipientCardLast4 ?? "?"}, ${receipt.date ?? "sana ?"}`
      : "🤖 AI: tekshirilmadi";
    const name = ctx.from.first_name;
    const autoOk = verdict.kind === "ok" && config.PAYMENT_AUTO_APPROVE && !(await hasBadPaymentHistory(ctx.from.id));

    if (autoOk) {
      const payment = await Payment.create({ ...base, status: "auto", decidedAt: new Date() });
      const granted = await grantSubscription(payment.telegramId, payment.days, payment.credits);
      const until = granted?.subscriptionUntil ? formatTashkent(granted.subscriptionUntil).slice(0, 10) : "—";
      await ctx.reply(texts.subscriptionGranted(until, payment.credits, granted?.credits ?? payment.credits), { ...html, reply_markup: backToMenu() });
      const note = `${escapeHtml(summary)}\n✅ Chek tekshiruvdan o'tdi, obuna <b>avtomatik berildi</b>.\nKartangizga pul tushmagan bo'lsa, qaytarib oling.`;
      return notifyAdmins(ctx, fileKind, fileId, texts.payAdmin(name, ctx.from.id, ctx.from.username, payment.amount, note), paymentRevokeKeyboard(payment.id));
    }

    const payment = await Payment.create({ ...base, status: "pending" });
    const issues = verdict.kind === "review" ? verdict.issues : [];
    const note =
      `${escapeHtml(summary)}\n` +
      (issues.length ? `⚠️ Tekshirish kerak: ${escapeHtml(issues.join("; "))}\n` : "") +
      "Kartangizga pul tushganini tekshirib, tasdiqlang.";
    await notifyAdmins(ctx, fileKind, fileId, texts.payAdmin(name, ctx.from.id, ctx.from.username, payment.amount, note), paymentDecisionKeyboard(payment.id));
    await ctx.reply(texts.payReceived, { reply_markup: backToMenu() });
  });

  // Admin: avtomatik berilgan obunani qaytarib olish (pul tushmagan bo'lsa)
  bot.callbackQuery(/^pay:rev:([a-f0-9]{24})$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCallbackQuery({ text: "Faqat admin uchun", show_alert: true });
    const payment = await revokePayment(ctx.match[1]!, ctx.from.id);
    if (!payment) return ctx.answerCallbackQuery({ text: "Bu to'lov allaqachon ko'rib chiqilgan", show_alert: true });
    await ctx.answerCallbackQuery();
    const user = await revokeSubscription(payment.telegramId, payment.days, payment.credits);
    await ctx.api.sendMessage(payment.telegramId, texts.payRevoked, { reply_markup: backToMenu() }).catch(() => undefined);
    const original = ctx.callbackQuery.message?.caption ?? "";
    await ctx.editMessageCaption({ caption: `${original}\n\n↩️ Qaytarib olindi, balans: ${user?.credits ?? 0} (${ctx.from.first_name})` }).catch(() => undefined);
  });
  bot.callbackQuery(/^pay:(ok|no):([a-f0-9]{24})$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCallbackQuery({ text: "Faqat admin uchun", show_alert: true });
    const approve = ctx.match[1] === "ok";
    const payment = await decidePayment(ctx.match[2]!, approve ? "approved" : "rejected", ctx.from.id);
    if (!payment) return ctx.answerCallbackQuery({ text: "Bu chek allaqachon ko'rib chiqilgan", show_alert: true });
    await ctx.answerCallbackQuery();

    let result: string;
    if (approve) {
      const user = await grantSubscription(payment.telegramId, payment.days, payment.credits);
      const until = user?.subscriptionUntil ? formatTashkent(user.subscriptionUntil).slice(0, 10) : "—";
      result = `✅ Tasdiqlandi: obuna ${until} gacha, +${payment.credits} kredit`;
      if (user) {
        await ctx.api
          .sendMessage(payment.telegramId, texts.subscriptionGranted(until, payment.credits, user.credits), { ...html, reply_markup: backToMenu() })
          .catch(() => undefined);
      }
    } else {
      result = "❌ Rad etildi";
      await ctx.api.sendMessage(payment.telegramId, texts.payRejected, { reply_markup: backToMenu() }).catch(() => undefined);
    }
    const original = ctx.callbackQuery.message?.caption ?? "";
    await ctx.editMessageCaption({ caption: `${original}\n\n${result} (${ctx.from.first_name})` }).catch(() => undefined);
  });
}
