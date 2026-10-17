import { Schema, model, type InferSchemaType } from "mongoose";

const WizardSchema = new Schema(
  {
    service: { type: String, required: true },
    step: { type: Number, required: true, default: 0 },
    answers: { type: Schema.Types.Mixed, default: {} },
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
