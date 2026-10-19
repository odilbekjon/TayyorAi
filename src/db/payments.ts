import { Payment } from "./models.js";
import { startOfMonth } from "./stats.js";

/** Admin tasdiqlashi yoki rad etishi: faqat hali ko'rib chiqilmagan to'lovni o'zgartiradi */
export async function decidePayment(id: string, status: "approved" | "rejected", adminId: number) {
  return Payment.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status, decidedBy: adminId, decidedAt: new Date() } },
    { returnDocument: "after" },
  );
}

/** Avtomatik berilgan to'lovni bekor qilish uchun belgilaydi */
export async function revokePayment(id: string, adminId: number) {
  return Payment.findOneAndUpdate(
    { _id: id, status: "auto" },
    { $set: { status: "revoked", decidedBy: adminId, decidedAt: new Date() } },
    { returnDocument: "after" },
  );
}

/** Shu fayl yoki tranzaksiya raqami bilan avval to'lov qilinganmi (rad etilganlardan tashqari) */
export async function isDuplicateReceipt(fileUniqueId: string, transactionId?: string | null) {
  const or: Record<string, string>[] = [{ fileUniqueId }];
  if (transactionId) or.push({ transactionId });
  return (await Payment.exists({ $or: or, status: { $ne: "rejected" } })) !== null;
}

/** Avval rad etilgan yoki qaytarib olingan to'lovi bo'lsa, avtomatik tasdiqlanmaydi */
export async function hasBadPaymentHistory(telegramId: number) {
  return (await Payment.exists({ telegramId, status: { $in: ["rejected", "revoked"] }, decidedBy: { $exists: true } })) !== null;
}

export async function hasPendingPayment(telegramId: number) {
  return (await Payment.exists({ telegramId, status: "pending" })) !== null;
}

/** Shu oydagi tasdiqlangan tushum va kutilayotgan cheklar soni */
export async function paymentStats() {
  const [month, pending] = await Promise.all([
    Payment.aggregate<{ total: number; count: number }>([
      { $match: { status: { $in: ["approved", "auto"] }, decidedAt: { $gte: startOfMonth() } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payment.countDocuments({ status: "pending" }),
  ]);
  return { monthRevenue: month[0]?.total ?? 0, monthPayments: month[0]?.count ?? 0, pending };
}
