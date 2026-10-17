import { Bot, GrammyError, InputFile, type Context } from "grammy";
import { AiBusyError, type GeminiClient } from "../ai/gemini.js";
import type { Config } from "../config.js";
import { Order, User } from "../db/models.js";
import { ensureUser, tryLock, unlock } from "../db/users.js";
import { escapeHtml } from "../lib/html.js";
import { Limiter } from "../lib/limiter.js";
import { SERVICES, getService } from "../services/registry.js";
import { costOf, type Answers, type ServiceDef } from "../services/types.js";
import { backToMenu, confirmKeyboard, mainMenu, stepKeyboard } from "./keyboards.js";
import { texts } from "./texts.js";

interface BotDeps {
  config: Config;
  gemini: GeminiClient;
}

export function createBot({ config, gemini }: BotDeps) {
  const bot = new Bot(config.BOT_TOKEN);
  // Bepul Gemini tarifi uchun: bir vaqtda 2 ta ish
  const limiter = new Limiter(2);

  const html = { parse_mode: "HTML" as const };
  const prices = SERVICES.map((s) => `${s.title}: ${s.cost} ${s.costFor ? "kreditdan" : "kredit"}`).join("\n");

  async function showMenu(ctx: Context, text: string) {
    await ctx.reply(text, { ...html, reply_markup: mainMenu() });
  }

  async function askStep(ctx: Context, service: ServiceDef, stepIndex: number) {
    const step = service.steps[stepIndex]!;
    await ctx.reply(step.question, { ...html, reply_markup: stepKeyboard(step, stepIndex) });
  }

  async function showSummary(ctx: Context, service: ServiceDef, answers: Answers, credits: number) {
    const lines = service.steps
      .filter((s) => answers[s.key])
      .map((s) => {
        const value = answers[s.key]!;
        const label = s.options?.find((o) => o.value === value)?.label ?? value;
        return `• ${escapeHtml(label)}`;
      });
    const text = [texts.summaryTitle, service.title, "", ...lines, texts.summaryCost(costOf(service, answers), credits)].join("\n");
    await ctx.reply(text, { ...html, reply_markup: confirmKeyboard() });
  }

  /** Javobni saqlab, keyingi savolga yoki tasdiqlashga o'tadi. */
  async function saveAnswer(ctx: Context, telegramId: number, stepIndex: number, value: string | null) {
    const user = await User.findOne({ telegramId });
    const service = getService(user?.wizard?.service);
    if (!user?.wizard || !service || user.wizard.step !== stepIndex) return;

    const step = service.steps[stepIndex]!;
    const next = stepIndex + 1;
    const update: Record<string, unknown> = { "wizard.step": next };
    if (value !== null) update[`wizard.answers.${step.key}`] = value;
    const updated = await User.findOneAndUpdate({ telegramId }, { $set: update }, { new: true });
    if (!updated?.wizard) return;

    if (next < service.steps.length) await askStep(ctx, service, next);
    else await showSummary(ctx, service, (updated.wizard.answers ?? {}) as Answers, updated.credits);
  }

  async function runJob(ctx: Context, telegramId: number, service: ServiceDef, answers: Answers, cost: number) {
    const started = Date.now();
    const header = texts.working(service.eta ?? "20-60 soniya", limiter.queued);
    const progress = await ctx.reply(header);
    // Telegram limitlariga tushmaslik uchun holat xabarini 3 soniyada bir martadan ko'p yangilamaymiz
    let lastEdit = 0;
    const onProgress = async (text: string) => {
      if (Date.now() - lastEdit < 3000) return;
      lastEdit = Date.now();
      await ctx.api.editMessageText(progress.chat.id, progress.message_id, `${header}\n\n${text}`).catch(() => undefined);
    };
    try {
      const result = await limiter.run(() =>
        service.generate!(answers, { gemini, pexelsKey: config.PEXELS_API_KEY, progress: onProgress }),
      );
      await ctx.replyWithDocument(new InputFile(result.file, result.filename), {
        caption: result.caption,
        ...html,
        reply_markup: backToMenu(),
      });
      await unlock(telegramId, cost);
      await Order.create({
        telegramId, service: service.id, answers, status: "done", credits: cost,
        durationMs: Date.now() - started, usage: result.usage,
      });
    } catch (err) {
      console.error(`[job] ${service.id} xato:`, err);
      await unlock(telegramId, 0);
      await Order.create({
        telegramId, service: service.id, answers, status: "failed", credits: 0,
        durationMs: Date.now() - started, error: String(err),
      }).catch(() => undefined);
      await ctx.reply(err instanceof AiBusyError ? texts.aiBusy : texts.failed, { reply_markup: backToMenu() });
    } finally {
      await ctx.api.deleteMessage(progress.chat.id, progress.message_id).catch(() => undefined);
    }
  }

  // Faqat shaxsiy chatda ishlaymiz va har bir foydalanuvchini bazada saqlaymiz
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private" || !ctx.from) return;
    await next();
  });

  bot.command("start", async (ctx) => {
    const user = await ensureUser(ctx.from!, config.FREE_CREDITS);
    await User.updateOne({ telegramId: user.telegramId, busy: false }, { $set: { wizard: null } });
    await ctx.reply(texts.welcome(ctx.from!.first_name, user.credits), { ...html, reply_markup: mainMenu() });
  });

  bot.command("menu", (ctx) => showMenu(ctx, texts.menu));
  bot.callbackQuery("menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showMenu(ctx, texts.menu);
  });

  const showBalance = async (ctx: Context) => {
    const user = await ensureUser(ctx.from!, config.FREE_CREDITS);
    await ctx.reply(texts.balance(user.credits, prices), { ...html, reply_markup: backToMenu() });
  };
  bot.command(["balans", "balance"], showBalance);
  bot.callbackQuery("balance", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showBalance(ctx);
  });

  bot.command("help", (ctx) => ctx.reply(texts.help, html));
  bot.callbackQuery("help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(texts.help, { ...html, reply_markup: backToMenu() });
  });

  const cancel = async (ctx: Context) => {
    await User.updateOne({ telegramId: ctx.from!.id }, { $set: { wizard: null } });
    await ctx.reply(texts.cancelled, { reply_markup: backToMenu() });
  };
  bot.command(["bekor", "cancel"], cancel);
  bot.callbackQuery("w:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup().catch(() => undefined);
    await cancel(ctx);
  });

  // Admin: /kredit <telegramId> <miqdor>
  bot.command("kredit", async (ctx) => {
    if (!config.ADMIN_IDS.includes(ctx.from!.id)) return;
    const [id, amount] = ctx.match.split(/\s+/).map(Number);
    if (!id || !amount) return ctx.reply("Format: /kredit <telegramId> <miqdor>");
    const user = await User.findOneAndUpdate({ telegramId: id }, { $inc: { credits: amount } }, { new: true });
    await ctx.reply(user ? `✅ ${id}: ${user.credits} kredit` : "Foydalanuvchi topilmadi");
  });

  // Xizmatni tanlash
  bot.callbackQuery(/^svc:(.+)$/, async (ctx) => {
    const service = getService(ctx.match[1]);
    if (!service?.enabled) return ctx.answerCallbackQuery({ text: texts.soon, show_alert: true });
    await ctx.answerCallbackQuery();
    await ensureUser(ctx.from, config.FREE_CREDITS);
    await User.updateOne({ telegramId: ctx.from.id }, { $set: { wizard: { service: service.id, step: 0, answers: {} } } });
    await askStep(ctx, service, 0);
  });

  // Tugmali javob: w:<qadam>:<variant | skip>
  bot.callbackQuery(/^w:(\d+):(\d+|skip)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const stepIndex = Number(ctx.match[1]);
    const user = await User.findOne({ telegramId: ctx.from.id });
    const service = getService(user?.wizard?.service);
    const step = service?.steps[stepIndex];
    if (!step || user?.wizard?.step !== stepIndex) return;

    let value: string | null = null;
    let label = "⏭";
    if (ctx.match[2] !== "skip") {
      const option = step.options?.[Number(ctx.match[2])];
      if (!option) return;
      value = option.value;
      label = option.label;
    }
    // Tanlangan javobni xabarda ko'rsatib, tugmalarni olib tashlaymiz
    await ctx.editMessageText(`${step.question}\n\n<b>✔️ ${escapeHtml(label)}</b>`, html).catch(() => undefined);
    await saveAnswer(ctx, ctx.from.id, stepIndex, value);
  });

  bot.callbackQuery("w:confirm", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup().catch(() => undefined);
    const telegramId = ctx.from.id;
    const current = await User.findOne({ telegramId });
    const service = getService(current?.wizard?.service);
    if (!current?.wizard || !service?.generate || current.wizard.step < service.steps.length) {
      return showMenu(ctx, texts.noWizard);
    }

    const answers = (current.wizard.answers ?? {}) as Answers;
    const cost = costOf(service, answers);
    const locked = await tryLock(telegramId, cost);
    if (!locked) {
      return ctx.reply(current.busy ? texts.busy : texts.notEnoughCredits(cost, current.credits), {
        ...html,
        reply_markup: backToMenu(),
      });
    }
    // Uzoq ishni kutmaymiz, aks holda bot boshqa foydalanuvchilarga javob bermay qoladi
    void runJob(ctx, telegramId, service, answers, cost);
  });

  // Matnli javoblar
  bot.on("message:text", async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const service = getService(user?.wizard?.service);
    const step = service?.steps[user?.wizard?.step ?? -1];
    if (!user?.wizard || !step) return showMenu(ctx, texts.noWizard);
    if (step.kind !== "text") return ctx.reply(texts.useButtons);

    const value = ctx.message.text.trim();
    if (step.minLength && value.length < step.minLength) return ctx.reply(texts.tooShort(step.minLength));
    if (step.maxLength && value.length > step.maxLength) return ctx.reply(texts.tooLong(step.maxLength));
    await saveAnswer(ctx, ctx.from.id, user.wizard.step, value);
  });

  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError) console.error(`[bot] Telegram xatosi: ${e.description}`);
    else console.error("[bot] Kutilmagan xato:", e);
  });

  return bot;
}
