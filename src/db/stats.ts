import { Activity, Order, User } from "./models.js";

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Toshkent vaqti bo'yicha kun kaliti ("YYYY-MM-DD"). `daysAgo` = necha kun oldin. */
export function dayKey(daysAgo = 0, now = Date.now()) {
  return new Date(now + TASHKENT_OFFSET_MS - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/** Toshkent vaqti bo'yicha bugungi kun boshlanishi (UTC Date). */
function startOfDay(daysAgo = 0) {
  return new Date(Date.parse(`${dayKey(daysAgo)}T00:00:00Z`) - TASHKENT_OFFSET_MS);
}

/**
 * Foydalanuvchi faolligini yozadi. Bir kunda bir foydalanuvchi uchun bazaga faqat
 * birinchi marta yoziladi (xotiradagi kesh), keyingi xabarlarda baza yuklanmaydi.
 */
export function createActivityTracker() {
  let today = dayKey();
  const seen = new Set<number>();

  return async function track(telegramId: number) {
    const day = dayKey();
    if (day !== today) {
      today = day;
      seen.clear();
    }
    if (seen.has(telegramId)) return;
    seen.add(telegramId);
    await Promise.all([
      Activity.updateOne({ day, telegramId }, { $inc: { hits: 1 } }, { upsert: true }),
      User.updateOne({ telegramId }, { $set: { lastSeenAt: new Date() } }),
    ]).catch((err) => {
      seen.delete(telegramId);
      console.error("[stats] faollik yozilmadi:", err);
    });
  };
}

export interface BotStats {
  totalUsers: number;
  newToday: number;
  newWeek: number;
  dau: Array<{ day: string; users: number }>;
  wau: number;
  ordersToday: { done: number; failed: number };
  ordersTotal: { done: number; failed: number };
  creditsSpentToday: number;
  topServices: Array<{ service: string; count: number }>;
  tokensWeek: { input: number; output: number };
}

export async function getStats(days = 7): Promise<BotStats> {
  const today = startOfDay(0);
  const weekAgo = startOfDay(days - 1);
  const dayKeys = Array.from({ length: days }, (_, i) => dayKey(i));

  const [totalUsers, newToday, newWeek, dauRows, wauRows, ordersToday, ordersTotal, topServices, tokens] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Activity.aggregate<{ _id: string; users: number }>([
        { $match: { day: { $in: dayKeys } } },
        { $group: { _id: "$day", users: { $sum: 1 } } },
      ]),
      Activity.distinct("telegramId", { day: { $in: dayKeys } }),
      countOrders({ createdAt: { $gte: today } }),
      countOrders({}),
      Order.aggregate<{ _id: string; count: number }>([
        { $match: { status: "done", createdAt: { $gte: weekAgo } } },
        { $group: { _id: "$service", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate<{ input: number; output: number }>([
        { $match: { createdAt: { $gte: weekAgo } } },
        { $group: { _id: null, input: { $sum: "$usage.inputTokens" }, output: { $sum: "$usage.outputTokens" } } },
      ]),
    ]);

  const dauMap = new Map(dauRows.map((r) => [r._id, r.users]));
  return {
    totalUsers,
    newToday,
    newWeek,
    dau: dayKeys.map((day) => ({ day, users: dauMap.get(day) ?? 0 })),
    wau: wauRows.length,
    ordersToday: { done: ordersToday.done, failed: ordersToday.failed },
    ordersTotal: { done: ordersTotal.done, failed: ordersTotal.failed },
    creditsSpentToday: ordersToday.credits,
    topServices: topServices.map((r) => ({ service: r._id, count: r.count })),
    tokensWeek: { input: tokens[0]?.input ?? 0, output: tokens[0]?.output ?? 0 },
  };
}

async function countOrders(match: Record<string, unknown>) {
  const rows = await Order.aggregate<{ _id: string; count: number; credits: number }>([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 }, credits: { $sum: "$credits" } } },
  ]);
  const by = (s: string) => rows.find((r) => r._id === s);
  return { done: by("done")?.count ?? 0, failed: by("failed")?.count ?? 0, credits: by("done")?.credits ?? 0 };
}

/** Eng oxirgi faol foydalanuvchilar (admin uchun: ID'ni topib kredit qo'shish oson bo'lsin) */
export async function recentUsers(limit = 15) {
  return User.find({}, { telegramId: 1, firstName: 1, username: 1, credits: 1, lastSeenAt: 1, createdAt: 1 })
    .sort({ lastSeenAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

/** "@username" yoki Telegram ID bo'yicha foydalanuvchini topadi */
export async function findUser(ref: string) {
  const username = ref.startsWith("@") ? ref.slice(1) : null;
  if (username) return User.findOne({ username: new RegExp(`^${escapeRegex(username)}$`, "i") });
  const id = Number(ref);
  return Number.isInteger(id) && id > 0 ? User.findOne({ telegramId: id }) : null;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
