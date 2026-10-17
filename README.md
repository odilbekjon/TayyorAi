# TayyorAI

Slayd, rezyume, kurs ishi, vizitka, taklifnoma, flayer, Excel va Word hujjatlarni tayyorlab beradigan Telegram bot.

## Hozir nima tayyor (1-bosqich)

- Bosh menyu: 8 ta xizmat, hammasi ishlaydi: Slayd, Rezyume, Kurs ishi/mustaqil ish, Word hujjat, Vizitka, Taklifnoma, Flayer, Excel.
- Savol-javob oqimi: har bir xizmat o'z savollarini `steps` ro'yxati orqali beradi (`src/services/*`).
- Kredit tizimi: yangi foydalanuvchiga `FREE_CREDITS` (standart 20 = 2 ta slayd). Kredit faqat fayl muvaffaqiyatli tayyorlangandan keyin yechiladi. Bir foydalanuvchi bir vaqtda faqat bitta ish buyurtma qila oladi.
- Slayd: Gemini mazmunni JSON qilib yozadi, PptxGenJS 4 xil dizaynda `.pptx` yasaydi. Rasmlar: `PEXELS_API_KEY` berilsa Pexels'dan, aks holda kalitsiz Wikimedia Commons'dan (manbasi rasm ostida yoziladi).
- Rezyume: foydalanuvchining xom ma'lumotini AI professional matnga aylantiradi, 3 xil dizaynda `.docx`.
- Word hujjat: ariza, tushuntirish xati, rasmiy xat, shartnoma, tavsifnoma. Berilmagan ma'lumot o'rniga `____` qoldiriladi.
- Kurs ishi: mustaqil ish (15 kredit), referat (20), kurs ishi (25). Avval reja, keyin har bir bo'lim alohida yoziladi. Titul varag'i, reja, kirish, boblar, xulosa, adabiyotlar va sahifa raqamlari bilan `.docx` (Times New Roman 14, 1.5 interval).
- Vizitka (90×50 mm, 4 dizayn), Taklifnoma (A5, 4 uslub), Flayer (A4 / Instagram post / story, 4 uslub): HTML/CSS shablon Chromium orqali PNG + PDF qilinadi.
- Excel: oylik byudjet, 12 oylik biznes prognoz, kredit to'lov jadvali (annuitet/differensial). Barcha hisoblar formulalar bilan, sariq kataklar tahrirlanadi.
- Admin buyruqlari (faqat `ADMIN_IDS` uchun):
  - `/stat`: jami foydalanuvchilar, bugungi va 7 kunlik faol foydalanuvchilar, tayyorlangan ishlar, eng ko'p ishlatilgan xizmatlar.
  - `/users`: oxirgi faol 20 ta foydalanuvchi (ID, username, balans).
  - `/kredit <telegramId | @username> <miqdor>`: kredit qo'shish (manfiy son ayiradi). Foydalanuvchiga xabar boradi.
- Har bir buyurtma `orders` kolleksiyasiga token sarfi bilan yoziladi, shunda real API xarajatini kuzatamiz.

## Ishga tushirish

Talablar: Node.js 22+, MongoDB (lokal yoki MongoDB Atlas bepul M0).

```bash
npm install
npx playwright install chromium   # vizitka, taklifnoma, flayer uchun (bir marta)
cp .env.example .env   # qiymatlarni to'ldiring
npm run dev            # o'zgarishlarda avtomatik qayta ishga tushadi
```

Production uchun:

```bash
npm run build
npm start
```

API kalitsiz dizaynni ko'rish: `npm run demo:slides` va `npm run demo:docs` (fayllar `out/` papkasida paydo bo'ladi).

## Tuzilma

```
src/
  index.ts              ishga tushirish, MongoDB ulanishi
  config.ts             .env tekshiruvi (zod)
  bot/                  menyu, savol-javob oqimi, matnlar
  db/                   Mongoose modellari, kredit va qulf funksiyalari
  ai/gemini.ts          Gemini mijozi: JSON schema bo'yicha javob
  lib/                  navbat, rasmlar (Pexels/Wikimedia), HTML→PNG/PDF, Word (docx) yordamchilar
  services/
    registry.ts         barcha xizmatlar ro'yxati va narxlari
    slides/             slayd: savollar, AI matni, dizayn mavzulari, pptx render
    resume/             rezyume (.docx)
    word/               rasmiy hujjatlar (.docx)
    coursework/         kurs ishi, referat, mustaqil ish (.docx)
    card/ invite/ flyer/  vizitka, taklifnoma, flayer (HTML → PNG + PDF)
    excel/              byudjet, biznes prognoz, kredit jadvali (.xlsx)
```

Yangi xizmat qo'shish: `src/services/<nom>/index.ts` da `ServiceDef` yozib, `registry.ts` dagi `soon(...)` qatorini almashtirish kifoya.
