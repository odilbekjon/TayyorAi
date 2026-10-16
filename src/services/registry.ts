import { slidesService } from "./slides/index.js";
import type { ServiceDef } from "./types.js";

/** Hali tayyor bo'lmagan xizmatlar menyuda "tez orada" bo'lib turadi. */
const soon = (id: string, title: string, cost: number): ServiceDef => ({ id, title, cost, enabled: false, steps: [] });

export const SERVICES: ServiceDef[] = [
  slidesService,
  soon("resume", "📄 Rezyume", 5),
  soon("coursework", "🎓 Kurs ishi / mustaqil ish", 15),
  soon("word", "📝 Word hujjat", 5),
  soon("card", "💳 Vizitka", 5),
  soon("invite", "💌 Taklifnoma", 8),
  soon("flyer", "📣 Flayer", 8),
  soon("excel", "📈 Moliyaviy jadval (Excel)", 5),
];

export function getService(id: string | undefined) {
  return SERVICES.find((s) => s.id === id);
}
