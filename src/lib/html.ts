/** Telegram HTML parse_mode uchun matnni xavfsiz qiladi. */
export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
