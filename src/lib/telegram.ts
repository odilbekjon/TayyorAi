import type { Api } from "grammy";

/** Bot API orqali faqat 20 MB gacha bo'lgan faylni yuklab olish mumkin */
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

/** Telegram'dan faylni yuklab oladi */
export async function downloadTelegramFile(api: Api, token: string, fileId: string) {
  const file = await api.getFile(fileId);
  if (!file.file_path) throw new Error("Fayl yo'li topilmadi");
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!res.ok) throw new Error(`Faylni yuklab bo'lmadi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
