import { z } from "zod";

const EnvSchema = z.object({
  BOT_TOKEN: z.string().min(20, "BOT_TOKEN kiritilmagan"),
  GEMINI_API_KEY: z.string().min(10, "GEMINI_API_KEY kiritilmagan"),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  MONGODB_URI: z.string().startsWith("mongodb", "MONGODB_URI noto'g'ri"),
  PEXELS_API_KEY: z.string().optional(),
  FREE_CREDITS: z.coerce.number().int().min(0).default(20),
  /** Oylik obuna: narxi (so'm), beriladigan kredit va muddati (kun) */
  SUBSCRIPTION_PRICE: z.coerce.number().int().min(0).default(10000),
  SUBSCRIPTION_CREDITS: z.coerce.number().int().min(0).default(100),
  SUBSCRIPTION_DAYS: z.coerce.number().int().min(1).default(30),
  ADMIN_IDS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // .env da bo'sh qoldirilgan qiymat (masalan "FREE_CREDITS=") standart qiymatni olishi kerak, 0 emas
  const cleaned = Object.fromEntries(
    Object.entries(env)
      .map(([k, v]) => [k, v?.trim()])
      .filter(([, v]) => v),
  );
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`.env sozlamalarida xato:\n${issues}`);
  }
  return parsed.data;
}
