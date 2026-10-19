import mongoose from "mongoose";
import { GeminiClient } from "./ai/gemini.js";
import { createBot } from "./bot/bot.js";
import { loadConfig } from "./config.js";
import { releaseStaleLocks } from "./db/users.js";
import { closeBrowser } from "./lib/html-render.js";

async function main() {
  const config = loadConfig();

  await mongoose.connect(config.MONGODB_URI);
  await releaseStaleLocks();
  console.log("✅ MongoDB ulandi");

  const gemini = new GeminiClient(config.GEMINI_API_KEY, config.GEMINI_MODEL);
  await gemini.checkModel();
  console.log(`✅ Gemini modeli: ${config.GEMINI_MODEL}`);
  const bot = createBot({ config, gemini });

  const commands = [
    { command: "start", description: "Boshlash" },
    { command: "menu", description: "Xizmatlar menyusi" },
    { command: "balans", description: "Kredit balansi" },
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
  ];
  if (config.ADMIN_IDS.length) console.log(`👑 Adminlar: ${config.ADMIN_IDS.join(", ")}`);
  else console.warn("⚠️ ADMIN_IDS bo'sh: /stat va boshqa admin buyruqlari hech kimga ishlamaydi");
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
