import type { Bot, Context } from "grammy";
import type { Config } from "../config.js";
import { Payment, User } from "../db/models.js";
import { decidePayment, hasPendingPayment } from "../db/payments.js";
import { formatTashkent } from "../db/stats.js";
import { grantSubscription } from "../db/users.js";
import { backToMenu, paymentDecisionKeyboard } from "./keyboards.js";
import { texts } from "./texts.js";

/** "Obuna sotib olish" bosilgandan keyin chek shu vaqt ichida qabul qilinadi */
const RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface PaymentDeps {
  config: Config;
  isAdmin: (ctx: Context) => boolean;
}

/**
 * Karta orqali qo'lda to'lov: foydalanuvchi kartaga pul o'tkazib chek yuboradi,
 * chek adminlarga boradi, admin tasdiqlasa obuna va kredit beriladi.
 */
export function registerPayments(bot: Bot, { config, isAdmin }: PaymentDeps) {
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

  // Chek: rasm yoki fayl (skrinshot, PDF)
  bot.on(["message:photo", "message:document"], async (ctx, next) => {
    const since = new Date(Date.now() - RECEIPT_WINDOW_MS);
    // Atomik: bir chek ikki marta yozilib qolmasin
    const user = await User.findOneAndUpdate(
      { telegramId: ctx.from.id, awaitingReceiptAt: { $gte: since } },
      { $unset: { awaitingReceiptAt: 1 } },
    );
    if (!user) return next();

    const photo = ctx.message.photo?.at(-1);
    const fileId = photo?.file_id ?? ctx.message.document!.file_id;
    const fileKind = photo ? "photo" : "document";
    const payment = await Payment.create({
      telegramId: ctx.from.id,
      amount: config.SUBSCRIPTION_PRICE,
      credits: config.SUBSCRIPTION_CREDITS,
      days: config.SUBSCRIPTION_DAYS,
      fileId,
      fileKind,
    });

    const caption = texts.payAdmin(ctx.from.first_name, ctx.from.id, ctx.from.username, payment.amount);
    const options = { caption, ...html, reply_markup: paymentDecisionKeyboard(payment.id) };
    for (const adminId of config.ADMIN_IDS) {
      const send = fileKind === "photo" ? ctx.api.sendPhoto(adminId, fileId, options) : ctx.api.sendDocument(adminId, fileId, options);
      await send.catch((err) => console.error(`[pay] admin ${adminId} ga chek yuborilmadi:`, err.description ?? err));
    }
    await ctx.reply(texts.payReceived, { reply_markup: backToMenu() });
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
