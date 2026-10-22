import { Schema, model, type InferSchemaType } from "mongoose";

const WizardSchema = new Schema(
  {
    service: { type: String, required: true },
    step: { type: Number, required: true, default: 0 },
    answers: { type: Schema.Types.Mixed, default: {} },
    /** Fayl so'raladigan qadamda yig'ilayotgan fayllar ("Tayyor" bosilguncha) */
    files: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    telegramId: { type: Number, required: true, unique: true },
    firstName: String,
    username: String,
    credits: { type: Number, required: true, default: 0, min: 0 },
    /** Bir vaqtda faqat bitta ish bajarilishi uchun */
    busy: { type: Boolean, default: false },
    /** Oxirgi marta botdan foydalangan vaqti */
    lastSeenAt: Date,
    /** Oylik obuna shu vaqtgacha faol (bo'lmasa obuna yo'q) */
    subscriptionUntil: Date,
    /** "Obuna sotib olish" bosilgan vaqt: shundan keyin yuborilgan rasm to'lov cheki deb olinadi */
    awaitingReceiptAt: Date,
    wizard: { type: WizardSchema, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = model("User", UserSchema);

const OrderSchema = new Schema(
  {
    telegramId: { type: Number, required: true, index: true },
    service: { type: String, required: true },
    answers: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["done", "failed"], required: true },
    credits: { type: Number, required: true },
    error: String,
    durationMs: Number,
    /** API xarajatini kuzatish uchun (token soni) */
    usage: { inputTokens: Number, outputTokens: Number, images: Number },
  },
  { timestamps: true },
);

export const Order = model("Order", OrderSchema);

/** Har kuni bir marta yoziladi: kunlik faol foydalanuvchilarni (DAU) sanash uchun */
const ActivitySchema = new Schema({
  /** Toshkent vaqti bo'yicha kun, masalan "2026-10-17" */
  day: { type: String, required: true },
  telegramId: { type: Number, required: true },
  /** Shu kuni nechta xabar/tugma bosgan */
  hits: { type: Number, default: 0 },
});
ActivitySchema.index({ day: 1, telegramId: 1 }, { unique: true });

export const Activity = model("Activity", ActivitySchema);

/** Karta orqali qo'lda to'lov: foydalanuvchi chek yuboradi, admin tasdiqlaydi */
const PaymentSchema = new Schema(
  {
    telegramId: { type: Number, required: true, index: true },
    amount: { type: Number, required: true },
    credits: { type: Number, required: true },
    days: { type: Number, required: true },
    /** auto = AI tekshiruvidan o'tib darhol berilgan (admin keyin qaytarib olishi mumkin), revoked = qaytarib olingan */
    status: { type: String, enum: ["pending", "approved", "rejected", "auto", "revoked"], default: "pending", index: true },
    /** Chek rasmi yoki fayli (Telegram file_id) */
    fileId: { type: String, required: true },
    /** Bir xil faylni qayta yuborishni aniqlash uchun (Telegram file_unique_id) */
    fileUniqueId: { type: String, index: true },
    /** Chekdagi tranzaksiya raqami: bitta chekni ikki marta ishlatishga yo'l qo'ymaslik uchun */
    transactionId: { type: String, index: true },
    /** AI tekshiruvi natijasi */
    ai: Schema.Types.Mixed,
    fileKind: { type: String, enum: ["photo", "document"], required: true },
    decidedBy: Number,
    decidedAt: Date,
  },
  { timestamps: true },
);

export const Payment = model("Payment", PaymentSchema);
