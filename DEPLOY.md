# Botni serverga qo'yish (24/7)

Bot Railway'da Docker konteyner sifatida ishlaydi: kompyuteringiz o'chiq bo'lsa ham bot javob beradi.
`main` branch'ga har push qilinganda Railway botni avtomatik qayta yig'ib, yangilaydi.

- `Dockerfile` — Playwright'ning rasmiy image'i asosida (Node + Chromium + shriftlar), vizitka/taklifnoma/flayer ham ishlaydi.
- `railway.json` — bitta nusxa (polling bot ikkita nusxada ishlamaydi), yiqilsa avtomatik qayta ishga tushadi.
- Sozlamalar Railway'dagi **Variables** bo'limida saqlanadi, `.env` fayli serverga kerak emas.

**Narx:** Railway Hobby tarifi oyiga $5, shu $5 ichida resurs sarfi ham bor. Bu bot (~300–500 MB RAM) odatda shu $5 ga sig'adi.
Yangi akkauntga bir martalik $5 sinov krediti beriladi. To'lov uchun Visa/Mastercard kerak.

## Qadamlar

1. **MongoDB Atlas'da tarmoqni oching.** Atlas → *Network Access* → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`). Railway'ning IP manzili doimiy emas, shuning uchun bu kerak. Parol baribir himoya qiladi.
2. **Railway akkaunt oching:** https://railway.com → *Login with GitHub*.
3. *New Project* → *Deploy from GitHub repo* → `odilbekjon/TayyorAi` ni tanlang (birinchi marta GitHub'ga ruxsat so'raydi).
4. Yaratilgan servisni oching → **Variables** → *Raw Editor* ga lokal `.env` faylingizdagi qatorlarni nusxalab qo'ying:
   ```
   BOT_TOKEN=...
   GEMINI_API_KEY=...
   GEMINI_MODEL=gemini-3.8-flash
   MONGODB_URI=mongodb+srv://...
   PIXABAY_API_KEY=...   # ixtiyoriy, bepul: pixabay.com/api/docs
   FREE_CREDITS=20
   ADMIN_IDS=...
   ```
   *Update Variables* → Railway botni qayta deploy qiladi.
5. **Kompyuteringizdagi botni to'xtating** (`npm run dev` oynasida `Ctrl+C`). Bir token bilan ikkita bot ishlasa, Telegram `409 Conflict` xatosini beradi.
6. *Deployments* → oxirgi deploy → *View Logs*. `✅ MongoDB ulandi` va `🤖 @... ishga tushdi` chiqsa, tayyor. `Rasm manbasi ...` qatorlari qaysi rasm manbasi ishlayotganini ko'rsatadi. Telegram'da `/start` bosib tekshiring.

## Keyin

- Kodni o'zgartirib `main` ga push qilsangiz, Railway o'zi yangilaydi.
- Lokal ishlab chiqish uchun botni qayta ishlatishdan oldin Railway'da servisni vaqtincha to'xtating (*Settings* → *Pause*) yoki BotFather'dan alohida test bot oching.
- `playwright` versiyasini yangilasangiz, `Dockerfile` dagi `mcr.microsoft.com/playwright:vX.Y.Z-noble` ni ham shu versiyaga o'zgartiring.

## Lokal sinash (ixtiyoriy)

```bash
docker build -t tayyorai .
docker run --rm --env-file .env tayyorai
```
