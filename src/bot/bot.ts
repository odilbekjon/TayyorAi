import { Bot, GrammyError, InputFile, type Context } from "grammy";
import { AiBusyError, type GeminiClient } from "../ai/gemini.js";
import type { Config } from "../config.js";
import { Order, User } from "../db/models.js";
import { createActivityTracker, findUser, formatTashkent, getStats, recentUsers } from "../db/stats.js";
import { ensureUser, grantSubscription, tryLock, unlock } from "../db/users.js";
import { escapeHtml } from "../lib/html.js";
import { Limiter } from "../lib/limiter.js";
import { checkPhotoProviders, type PhotoKeys } from "../lib/photos.js";
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
  const photoKeys: PhotoKeys = { pexels: config.PEXELS_API_KEY, pixabay: config.PIXABAY_API_KEY };
  // Bepul Gemini tarifi uchun: bir vaqtda 2 ta ish
  const limiter = new Limiter(2);

  const html = { parse_mode: "HTML" as const };
  const prices = SERVICES.map((s) => `${s.title}: ${s.cost} ${s.costFor ? "kreditdan" : "kredit"}`).join("\n");

  const isAdmin = (ctx: Context) => config.ADMIN_IDS.includes(ctx.from!.id);

  /** Admin bo'lmasa, ID'sini ko'rsatadi: uni Railway'dagi ADMIN_IDS ga qo'shish kerak bo'ladi */
  async function requireAdmin(ctx: Context) {
    if (isAdmin(ctx)) return true;
    await ctx.reply(texts.notAdmin(ctx.from!.id), html);
    return false;
  }

  async function showMenu(ctx: Context, text: string) {
    await ctx.reply(text, { ...html, reply_markup: mainMenu(isAdmin(ctx)) });
  }

  function subscriptionLine(until?: Date | null) {
    return until && until.getTime() > Date.now()
      ? texts.subscriptionActive(formatTashkent(until).slice(0, 10), Math.ceil((until.getTime() - Date.now()) / 86_400_000))
      : texts.subscriptionNone(config.SUBSCRIPTION_PRICE, config.SUBSCRIPTION_CREDITS, config.SUBSCRIPTION_DAYS);
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
    const updated = await User.findOneAndUpdate({ telegramId }, { $set: update }, { returnDocument: "after" });
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
        service.generate!(answers, { gemini, photoKeys, progress: onProgress }),
      );
      if (result.preview) await ctx.replyWithPhoto(new InputFile(result.preview, "preview.png"));
      for (const extra of result.extra ?? []) await ctx.replyWithDocument(new InputFile(extra.file, extra.filename));
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
  const trackActivity = createActivityTracker();
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private" || !ctx.from) return;
    void trackActivity(ctx.from.id);
    await next();
  });

  bot.command("start", async (ctx) => {
    const user = await ensureUser(ctx.from!, config.FREE_CREDITS);
    await User.updateOne({ telegramId: user.telegramId, busy: false }, { $set: { wizard: null } });
    await ctx.reply(texts.welcome(ctx.from!.first_name, user.credits, subscriptionLine(user.subscriptionUntil)), {
      ...html,
      reply_markup: mainMenu(isAdmin(ctx)),
    });
  });

  bot.command("menu", (ctx) => showMenu(ctx, texts.menu));
  bot.callbackQuery("menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showMenu(ctx, texts.menu);
  });

  const showBalance = async (ctx: Context) => {
    const user = await ensureUser(ctx.from!, config.FREE_CREDITS);
    await ctx.reply(texts.balance(user.credits, prices, subscriptionLine(user.subscriptionUntil)), { ...html, reply_markup: backToMenu() });
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

  // Admin: /stat — foydalanuvchilar va buyurtmalar statistikasi
  const sendStats = async (ctx: Context) => {
    if (!(await requireAdmin(ctx))) return;
    const s = await getStats(7);
    const title = (id: string) => getService(id)?.title ?? id;
    const lines = [
      "📊 <b>TayyorAI statistikasi</b>",
      "",
      `👥 Jami foydalanuvchilar: <b>${s.totalUsers}</b>`,
      `🆕 Yangi: bugun <b>${s.newToday}</b>, 7 kunda <b>${s.newWeek}</b>`,
      `🆕 Shu oyda yangi: <b>${s.newMonth}</b>`,
      `🔥 Faol: bugun <b>${s.dau[0]!.users}</b>, 7 kunda <b>${s.wau}</b>, shu oyda <b>${s.mau}</b>`,
      `⭐ Faol obunachilar: <b>${s.activeSubscribers}</b>`,
      "",
      "<b>Kunlik faol foydalanuvchilar:</b>",
      ...s.dau.map((d) => `${d.day.slice(5)}: ${d.users}`),
      "",
      `📄 Bugun tayyorlangan: <b>${s.ordersToday.done}</b> ta (xato: ${s.ordersToday.failed})`,
      `🗓 Shu oyda tayyorlangan: <b>${s.ordersMonth.done}</b> ta (xato: ${s.ordersMonth.failed})`,
      `📦 Jami tayyorlangan: <b>${s.ordersTotal.done}</b> ta (xato: ${s.ordersTotal.failed})`,
      `💰 Bugun sarflangan kredit: <b>${s.creditsSpentToday}</b>`,
      "",
      "<b>7 kunda eng ko'p ishlatilgan:</b>",
      ...(s.topServices.length ? s.topServices.map((t) => `${title(t.service)}: ${t.count}`) : ["hali yo'q"]),
      "",
      `🔢 7 kunlik token: ${s.tokensWeek.input.toLocaleString("en-US")} kirish / ${s.tokensWeek.output.toLocaleString("en-US")} chiqish`,
    ];
    await ctx.reply(lines.join("\n"), { ...html, reply_markup: backToMenu() });
  };
  bot.command(["stat", "statistika"], sendStats);
  bot.callbackQuery("admin:stat", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendStats(ctx);
  });

  // Admin: /rasm — rasm manbalari serverdan ishlayaptimi
  bot.command("rasm", async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.reply("🖼 Rasm manbalari tekshirilmoqda...");
    const results = await checkPhotoProviders(photoKeys);
    const lines = results.map((r) => `${r.ok ? "✅" : "❌"} <b>${r.name}</b>: ${escapeHtml(r.detail)}`);
    await ctx.reply(["🖼 <b>Rasm manbalari</b>", "", ...lines].join("\n"), html);
  });

  // Admin: /users — oxirgi faol foydalanuvchilar ro'yxati (ID'ni bilish uchun)
  const sendUsers = async (ctx: Context) => {
    if (!(await requireAdmin(ctx))) return;
    const users = await recentUsers(20);
    const fmt = (d?: Date | null) => (d ? formatTashkent(d).slice(5) : "—");
    const lines = users.map((u) => {
      const sub = u.subscriptionUntil && u.subscriptionUntil.getTime() > Date.now() ? ` · ⭐ ${formatTashkent(u.subscriptionUntil).slice(5, 10)} gacha` : "";
      return `<code>${u.telegramId}</code> ${escapeHtml(u.firstName ?? "")}${u.username ? ` @${escapeHtml(u.username)}` : ""} · ${u.credits} kr${sub} · ${fmt(u.lastSeenAt)}`;
    });
    await ctx.reply(["👥 <b>Oxirgi faol foydalanuvchilar</b> (⭐ = obunachi)", "", ...lines].join("\n"), {
      ...html,
      reply_markup: backToMenu(),
    });
  };
  bot.command("users", sendUsers);
  bot.callbackQuery("admin:users", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendUsers(ctx);
  });

  // Admin: /obuna <telegramId | @username> [kun] — oylik obuna beradi (kredit ham qo'shiladi)
  bot.command("obuna", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const [ref, rawDays] = ctx.match.trim().split(/\s+/);
    const days = rawDays ? Number(rawDays) : config.SUBSCRIPTION_DAYS;
    if (!ref || !Number.isInteger(days) || days <= 0) {
      return ctx.reply(`Format: /obuna <telegramId | @username> [kun]\nMasalan: /obuna @ali (${config.SUBSCRIPTION_DAYS} kun, ${config.SUBSCRIPTION_CREDITS} kredit)`);
    }
    const target = await findUser(ref);
    if (!target) return ctx.reply("Foydalanuvchi topilmadi. U avval botga /start bosgan bo'lishi kerak.");
    const credits = Math.round((config.SUBSCRIPTION_CREDITS * days) / config.SUBSCRIPTION_DAYS);
    const user = await grantSubscription(target.telegramId, days, credits);
    if (!user?.subscriptionUntil) return ctx.reply("Foydalanuvchi topilmadi");
    const until = formatTashkent(user.subscriptionUntil).slice(0, 10);
    const name = escapeHtml(user.firstName ?? String(user.telegramId));
    await ctx.reply(`⭐ ${name} (<code>${user.telegramId}</code>): obuna ${until} gacha, +${credits} kredit, balans <b>${user.credits}</b>`, html);
    await ctx.api
      .sendMessage(user.telegramId, texts.subscriptionGranted(until, credits, user.credits), { ...html, reply_markup: backToMenu() })
      .catch(() => undefined);
  });

  // Admin: /kredit <telegramId | @username> <miqdor> (manfiy miqdor kreditni ayiradi)
  bot.command("kredit", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const [ref, rawAmount] = ctx.match.trim().split(/\s+/);
    const amount = Number(rawAmount);
    if (!ref || !Number.isInteger(amount) || amount === 0) {
      return ctx.reply("Format: /kredit <telegramId | @username> <miqdor>\nMasalan: /kredit @ali 100 yoki /kredit 123456789 -20");
    }
    const target = await findUser(ref);
    if (!target) return ctx.reply("Foydalanuvchi topilmadi. U avval botga /start bosgan bo'lishi kerak.");
    // Balans 0 dan pastga tushmasin
    const user = await User.findOneAndUpdate(
      { telegramId: target.telegramId },
      [{ $set: { credits: { $max: [0, { $add: ["$credits", amount] }] } } }],
      { returnDocument: "after", updatePipeline: true },
    );
    if (!user) return ctx.reply("Foydalanuvchi topilmadi");
    const name = escapeHtml(user.firstName ?? String(user.telegramId));
    await ctx.reply(`✅ ${name} (<code>${user.telegramId}</code>): ${amount > 0 ? "+" : ""}${amount}, balans <b>${user.credits}</b> kredit`, html);
    if (amount > 0) {
      await ctx.api
        .sendMessage(user.telegramId, texts.creditsAdded(amount, user.credits), { ...html, reply_markup: backToMenu() })
        .catch(() => undefined);
    }
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
