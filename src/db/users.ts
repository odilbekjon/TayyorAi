import type { User as TgUser } from "grammy/types";
import { User } from "./models.js";

/** Foydalanuvchini topadi yoki birinchi kirishda bepul kredit bilan yaratadi. */
export async function ensureUser(from: TgUser, freeCredits: number) {
  return User.findOneAndUpdate(
    { telegramId: from.id },
    {
      $set: { firstName: from.first_name, username: from.username },
      $setOnInsert: { credits: freeCredits },
    },
    { upsert: true, returnDocument: "after" },
  );
}

/** Ishni boshlashdan oldin: kredit yetarli va boshqa ish bajarilmayotgan bo'lsa band qiladi. */
export async function tryLock(telegramId: number, cost: number) {
  return User.findOneAndUpdate(
    { telegramId, busy: { $ne: true }, credits: { $gte: cost } },
    { $set: { busy: true } },
    { returnDocument: "after" },
  );
}

/** Ish tugagach qulfni ochadi; muvaffaqiyatli bo'lsa kreditni yechadi. */
export async function unlock(telegramId: number, chargeCredits: number) {
  await User.updateOne(
    { telegramId },
    { $set: { busy: false, wizard: null }, $inc: { credits: -chargeCredits } },
  );
}

/** Server qayta ishga tushganda osilib qolgan qulflarni tozalaydi. */
export async function releaseStaleLocks() {
  await User.updateMany({ busy: true }, { $set: { busy: false } });
}
