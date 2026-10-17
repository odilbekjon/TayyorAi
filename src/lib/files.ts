/** Fayl nomi uchun xavfli belgilarni olib tashlaydi. */
export function safeFilename(s: string, fallback: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 60) || fallback;
}
