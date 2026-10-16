import { courseworkService } from "./coursework/index.js";
import { resumeService } from "./resume/index.js";
import { slidesService } from "./slides/index.js";
import type { ServiceDef } from "./types.js";
import { wordService } from "./word/index.js";

/** Hali tayyor bo'lmagan xizmatlar menyuda "tez orada" bo'lib turadi. */
const soon = (id: string, title: string, cost: number): ServiceDef => ({ id, title, cost, enabled: false, steps: [] });

export const SERVICES: ServiceDef[] = [
  slidesService,
  resumeService,
  courseworkService,
  wordService,
  soon("card", "💳 Vizitka", 5),
  soon("invite", "💌 Taklifnoma", 8),
  soon("flyer", "📣 Flayer", 8),
  soon("excel", "📈 Moliyaviy jadval (Excel)", 5),
];

export function getService(id: string | undefined) {
  return SERVICES.find((s) => s.id === id);
}
