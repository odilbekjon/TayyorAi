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

/**
 * Oylik obunani beradi yoki uzaytiradi: muddat hozirgi tugash sanasidan (yoki bugundan)
 * `days` kunga suriladi va `credits` kredit qo'shiladi.
 */
export async function grantSubscription(telegramId: number, days: number, credits: number) {
  const ms = days * 86_400_000;
  return User.findOneAndUpdate(
    { telegramId },
    [
      {
        $set: {
          subscriptionUntil: { $add: [{ $max: ["$$NOW", { $ifNull: ["$subscriptionUntil", "$$NOW"] }] }, ms] },
          credits: { $add: ["$credits", credits] },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  );
}

/** Avtomatik berilgan obunani qaytarib oladi: muddatni qisqartiradi va kreditni ayiradi (0 dan pastga tushmaydi) */
export async function revokeSubscription(telegramId: number, days: number, credits: number) {
  const ms = days * 86_400_000;
  return User.findOneAndUpdate(
    { telegramId },
    [
      {
        $set: {
          subscriptionUntil: { $subtract: [{ $ifNull: ["$subscriptionUntil", "$$NOW"] }, ms] },
          credits: { $max: [0, { $subtract: ["$credits", credits] }] },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  );
}
