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

export async function hasPendingPayment(telegramId: number) {
  return (await Payment.exists({ telegramId, status: "pending" })) !== null;
}

/** Shu oydagi tasdiqlangan tushum va kutilayotgan cheklar soni */
export async function paymentStats() {
  const [month, pending] = await Promise.all([
    Payment.aggregate<{ total: number; count: number }>([
      { $match: { status: "approved", decidedAt: { $gte: startOfMonth() } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payment.countDocuments({ status: "pending" }),
  ]);
  return { monthRevenue: month[0]?.total ?? 0, monthPayments: month[0]?.count ?? 0, pending };
}
