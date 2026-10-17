import { cardService } from "./card/index.js";
import { courseworkService } from "./coursework/index.js";
import { excelService } from "./excel/index.js";
import { flyerService } from "./flyer/index.js";
import { inviteService } from "./invite/index.js";
import { resumeService } from "./resume/index.js";
import { slidesService } from "./slides/index.js";
import type { ServiceDef } from "./types.js";
import { wordService } from "./word/index.js";

export const SERVICES: ServiceDef[] = [
  slidesService,
  resumeService,
  courseworkService,
  wordService,
  cardService,
  inviteService,
  flyerService,
  excelService,
];

export function getService(id: string | undefined) {
  return SERVICES.find((s) => s.id === id);
}
