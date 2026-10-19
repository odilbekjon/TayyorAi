import mongoose from "mongoose";
import { GeminiClient } from "./ai/gemini.js";
import { createBot } from "./bot/bot.js";
import { loadConfig } from "./config.js";
import { releaseStaleLocks } from "./db/users.js";
import { closeBrowser } from "./lib/html-render.js";
import { checkPhotoProviders } from "./lib/photos.js";

async function main() {
  const config = loadConfig();

  await mongoose.connect(config.MONGODB_URI);
  await releaseStaleLocks();
  console.log("✅ MongoDB ulandi");

  const gemini = new GeminiClient(config.GEMINI_API_KEY, config.GEMINI_MODEL);
  await gemini.checkModel();
  console.log(`✅ Gemini modeli: ${config.GEMINI_MODEL}`);
  const bot = createBot({ config, gemini });

  // Rasm manbalari serverdan ochiladimi: natija loglarda ko'rinadi (botni kutdirmaydi)
  void checkPhotoProviders({ pexels: config.PEXELS_API_KEY, pixabay: config.PIXABAY_API_KEY }).then((results) => {
    for (const r of results) console.log(`${r.ok ? "✅" : "⚠️"} Rasm manbasi ${r.name}: ${r.detail}`);
  });

  const commands = [
    { command: "start", description: "Boshlash" },
    { command: "menu", description: "Xizmatlar menyusi" },
    { command: "balans", description: "Kredit balansi" },
    { command: "tolov", description: "Obuna sotib olish" },
    { command: "bekor", description: "Joriy ishni bekor qilish" },
    { command: "help", description: "Yordam" },
  ];
  await bot.api.setMyCommands(commands);
  // Adminlarga qo'shimcha buyruqlar menyuda ko'rinadi
  const adminCommands = [
    ...commands,
    { command: "stat", description: "Statistika (admin)" },
    { command: "users", description: "Oxirgi foydalanuvchilar (admin)" },
    { command: "kredit", description: "Kredit qo'shish (admin)" },
    { command: "obuna", description: "Oylik obuna berish (admin)" },
    { command: "rasm", description: "Rasm manbalarini tekshirish (admin)" },
  ];
  if (config.ADMIN_IDS.length) console.log(`👑 Adminlar: ${config.ADMIN_IDS.join(", ")}`);
  else console.warn("⚠️ ADMIN_IDS bo'sh: /stat va boshqa admin buyruqlari hech kimga ishlamaydi");
  if (!config.PAYMENT_CARD) console.warn("⚠️ PAYMENT_CARD bo'sh: foydalanuvchilar obuna sotib ola olmaydi");
  for (const chatId of config.ADMIN_IDS) {
    await bot.api
      .setMyCommands(adminCommands, { scope: { type: "chat", chat_id: chatId } })
      .catch((err) => console.warn(`[bot] admin ${chatId} buyruqlari o'rnatilmadi:`, err.description ?? err));
  }

  const shutdown = async () => {
    await bot.stop();
    await closeBrowser();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await bot.start({ onStart: (me) => console.log(`🤖 @${me.username} ishga tushdi`) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
