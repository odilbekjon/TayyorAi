import { chromium, type Browser } from "playwright";

/**
 * Vizitka, taklifnoma va flayerlar HTML/CSS shablon sifatida chiziladi va
 * Chromium orqali PNG va PDF'ga aylantiriladi. Brauzer bir marta ochilib,
 * keyingi ishlarda qayta ishlatiladi (har safar ochish 1-2 soniya oladi).
 */
let browserPromise: Promise<Browser> | null = null;

function getBrowser() {
  browserPromise ??= chromium
    .launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
    .then((browser) => {
      // Brauzer kutilmaganda yopilsa, keyingi so'rovda qayta ochiladi
      browser.on("disconnected", () => (browserPromise = null));
      return browser;
    })
    .catch((err: unknown) => {
      browserPromise = null;
      throw new Error(
        `Chromium ishga tushmadi. "npx playwright install chromium" buyrug'ini bajaring. Sabab: ${err instanceof Error ? err.message : err}`,
      );
    });
  return browserPromise;
}

export async function closeBrowser() {
  const browser = await browserPromise?.catch(() => null);
  await browser?.close();
  browserPromise = null;
}

export interface RenderedDesign {
  png: Buffer;
  pdf: Buffer;
}

/**
 * @param width, height  dizayn o'lchami CSS pikselda (96 dpi)
 * @param scale          PNG aniqligi: 3.125 ≈ 300 dpi (chop etish uchun)
 */
export async function renderHtml(html: string, width: number, height: number, scale = 2): Promise<RenderedDesign> {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  try {
    const page = await context.newPage();
    // Google Fonts yuklanishini kutamiz, lekin internet sekin bo'lsa ham to'xtab qolmaymiz
    await page.setContent(html, { waitUntil: "networkidle", timeout: 20_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready).catch(() => undefined);

    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
    const pdf = await page.pdf({ width: `${width}px`, height: `${height}px`, printBackground: true, pageRanges: "1" });
    return { png, pdf };
  } finally {
    await context.close();
  }
}

/** mm → CSS piksel (96 dpi) */
export const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4);

export const GOOGLE_FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Great+Vibes&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">';

/** HTML ichiga qo'yiladigan matnni xavfsiz qiladi. */
export function esc(s: string | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function page(width: number, height: number, css: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8">${GOOGLE_FONTS}<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${width}px;height:${height}px;overflow:hidden}
body{-webkit-font-smoothing:antialiased}
${css}</style></head><body>${body}</body></html>`;
}
