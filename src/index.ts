import mongoose from "mongoose";
import { GeminiClient } from "./ai/gemini.js";
import { createBot } from "./bot/bot.js";
import { loadConfig } from "./config.js";
import { releaseStaleLocks } from "./db/users.js";

async function main() {
  const config = loadConfig();

  await mongoose.connect(config.MONGODB_URI);
  await releaseStaleLocks();
  console.log("✅ MongoDB ulandi");

  const gemini = new GeminiClient(config.GEMINI_API_KEY, config.GEMINI_MODEL);
  await gemini.checkModel();
  console.log(`✅ Gemini modeli: ${config.GEMINI_MODEL}`);
  const bot = createBot({ config, gemini });

  await bot.api.setMyCommands([
    { command: "start", description: "Boshlash" },
    { command: "menu", description: "Xizmatlar menyusi" },
    { command: "balans", description: "Kredit balansi" },
    { command: "bekor", description: "Joriy ishni bekor qilish" },
    { command: "help", description: "Yordam" },
  ]);

  const shutdown = async () => {
    await bot.stop();
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
