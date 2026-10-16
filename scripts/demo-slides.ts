/**
 * API kalitsiz slayd dizaynini tekshirish: namunaviy matndan barcha mavzularda .pptx yasaydi.
 * Ishga tushirish: npm run demo:slides  → out/ papkasida fayllar paydo bo'ladi
 */
import { mkdir, writeFile } from "node:fs/promises";
import type { Deck } from "../src/services/slides/content.js";
import { renderDeck } from "../src/services/slides/render.js";
import { THEMES } from "../src/services/slides/themes.js";

const deck: Deck = {
  title: "Sun'iy intellektning ta'limdagi o'rni",
  subtitle: "Imkoniyatlar, xavflar va amaliy tavsiyalar",
  slides: [
    {
      title: "Sun'iy intellekt nima?",
      bullets: [
        "Kompyuterga inson kabi o'rganish va qaror qabul qilish qobiliyatini beruvchi texnologiya",
        "Katta hajmdagi ma'lumotlar asosida qonuniyatlarni topadi",
        "Bugun matn yozish, tarjima va rasm yaratishda keng qo'llaniladi",
      ],
      imageQuery: "artificial intelligence",
    },
    {
      title: "Ta'limdagi imkoniyatlar",
      bullets: [
        "Har bir o'quvchiga moslashtirilgan shaxsiy ta'lim yo'li",
        "O'qituvchining tekshirish va hujjat ishlariga sarflanadigan vaqtini kamaytiradi",
        "Istalgan vaqtda savol berish mumkin bo'lgan virtual yordamchi",
        "Imkoniyati cheklangan o'quvchilar uchun qulay vositalar",
      ],
      imageQuery: "students laptop classroom",
    },
    {
      title: "Xavflar va cheklovlar",
      bullets: [
        "Tayyor javobga tayanib, mustaqil fikrlashning susayishi",
        "Noto'g'ri yoki uydirma ma'lumot berish ehtimoli",
        "Shaxsiy ma'lumotlar xavfsizligi masalasi",
      ],
      imageQuery: "warning risk technology",
    },
  ],
  conclusion: "Sun'iy intellekt o'qituvchining o'rnini bosmaydi, balki uning eng kuchli yordamchisiga aylanadi.",
};

await mkdir("out", { recursive: true });
for (const theme of THEMES) {
  const file = await renderDeck(deck, { theme, author: "Aliyev Vali, TATU 2-kurs", language: "uz_latn", images: [] });
  await writeFile(`out/demo-${theme.id}.pptx`, file);
  console.log(`out/demo-${theme.id}.pptx (${Math.round(file.length / 1024)} KB)`);
}
