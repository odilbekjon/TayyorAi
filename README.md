# TayyorAI

Slayd, rezyume, kurs ishi, vizitka, taklifnoma, flayer, Excel va Word hujjatlarni tayyorlab beradigan Telegram bot.

## Hozir nima tayyor (1-bosqich)

- Bosh menyu: 8 ta xizmat. **Slayd, Rezyume, Kurs ishi/mustaqil ish, Word hujjat** ishlaydi, qolganlari "tez orada" belgisi bilan turadi.
- Savol-javob oqimi: har bir xizmat o'z savollarini `steps` ro'yxati orqali beradi (`src/services/*`).
- Kredit tizimi: yangi foydalanuvchiga `FREE_CREDITS` (standart 20 = 2 ta slayd). Kredit faqat fayl muvaffaqiyatli tayyorlangandan keyin yechiladi. Bir foydalanuvchi bir vaqtda faqat bitta ish buyurtma qila oladi.
- Slayd: Gemini mazmunni JSON qilib yozadi, PptxGenJS 4 xil dizaynda `.pptx` yasaydi. `PEXELS_API_KEY` berilsa slaydlarga bepul real fotolar qo'shiladi.
- Rezyume: foydalanuvchining xom ma'lumotini AI professional matnga aylantiradi, 3 xil dizaynda `.docx`.
- Word hujjat: ariza, tushuntirish xati, rasmiy xat, shartnoma, tavsifnoma. Berilmagan ma'lumot o'rniga `____` qoldiriladi.
- Kurs ishi: mustaqil ish (15 kredit), referat (20), kurs ishi (25). Avval reja, keyin har bir bo'lim alohida yoziladi. Titul varag'i, reja, kirish, boblar, xulosa, adabiyotlar va sahifa raqamlari bilan `.docx` (Times New Roman 14, 1.5 interval).
- Admin buyrug'i: `/kredit <telegramId> <miqdor>` (faqat `ADMIN_IDS` uchun).
- Har bir buyurtma `orders` kolleksiyasiga token sarfi bilan yoziladi, shunda real API xarajatini kuzatamiz.

## Ishga tushirish

Talablar: Node.js 22+, MongoDB (lokal yoki MongoDB Atlas bepul M0).

```bash
npm install
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
  lib/                  navbat (limiter), Pexels, HTML va Word (docx) yordamchilar
  services/
    registry.ts         barcha xizmatlar ro'yxati va narxlari
    slides/             slayd: savollar, AI matni, dizayn mavzulari, pptx render
    resume/             rezyume (.docx)
    word/               rasmiy hujjatlar (.docx)
    coursework/         kurs ishi, referat, mustaqil ish (.docx)
```

Yangi xizmat qo'shish: `src/services/<nom>/index.ts` da `ServiceDef` yozib, `registry.ts` dagi `soon(...)` qatorini almashtirish kifoya.
