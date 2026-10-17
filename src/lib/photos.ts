/**
 * Slayd va flayerlar uchun bepul real fotolar.
 * 1) PEXELS_API_KEY berilgan bo'lsa: Pexels (sifatli stok fotolar)
 * 2) Aks holda: Wikimedia Commons (kalit kerak emas, CC litsenziyali rasmlar)
 */
export interface Photo {
  buffer: Buffer;
  mime: "image/jpeg" | "image/png";
  /** Asl o'lchamlar (nisbatni saqlab kesish uchun) */
  width: number;
  height: number;
  /** Rasm manbasi, slaydda kichik yozuv sifatida ko'rsatiladi */
  credit: string;
}

const USER_AGENT = "TayyorAI-bot/0.1 (Telegram bot; https://github.com/odilbekjon/TayyorAi)";
const TIMEOUT = 15_000;

async function download(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function fromPexels(apiKey: string, query: string, orientation: string, used: Set<string>): Promise<Photo | null> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orientation", orientation);
  const res = await fetch(url, { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    photos?: Array<{ src: { large: string }; photographer: string; width: number; height: number }>;
  };
  const photo = body.photos?.find((p) => !used.has(p.src.large));
  if (!photo) return null;
  const buffer = await download(photo.src.large);
  if (!buffer) return null;
  used.add(photo.src.large);
  return {
    buffer, mime: "image/jpeg", width: photo.width, height: photo.height,
    credit: `Foto: ${photo.photographer} / Pexels`,
  };
}

interface CommonsPage {
  index: number;
  imageinfo?: Array<{
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    mime: string;
    extmetadata?: { LicenseShortName?: { value: string } };
  }>;
}

async function fromWikimedia(query: string, used: Set<string>): Promise<Photo | null> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6", // faqat fayllar
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1280",
    iiextmetadatafilter: "LicenseShortName",
  }).toString();

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return null;
  const body = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const pages = Object.values(body.query?.pages ?? {}).sort((a, b) => a.index - b.index);

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !info.thumbwidth || !info.thumbheight || used.has(info.thumburl)) continue;
    if (info.mime !== "image/jpeg" && info.mime !== "image/png") continue;
    const buffer = await download(info.thumburl);
    if (!buffer) continue;
    used.add(info.thumburl);
    const license = info.extmetadata?.LicenseShortName?.value;
    return {
      buffer, mime: info.mime, width: info.thumbwidth, height: info.thumbheight,
      credit: `Rasm: Wikimedia Commons${license ? `, ${license}` : ""}`,
    };
  }
  return null;
}

/**
 * Bir hujjat ichida bir xil rasm takrorlanmasligi uchun `used` to'plamini
 * barcha chaqiruvlarda bitta qilib uzating. Topilmasa null (xato tashlamaydi).
 */
export async function findPhoto(
  query: string,
  opts: { pexelsKey?: string; orientation?: "landscape" | "portrait" | "square"; used?: Set<string> } = {},
): Promise<Photo | null> {
  const used = opts.used ?? new Set<string>();
  try {
    if (opts.pexelsKey) {
      const photo = await fromPexels(opts.pexelsKey, query, opts.orientation ?? "landscape", used);
      if (photo) return photo;
    }
    return await fromWikimedia(query, used);
  } catch {
    return null;
  }
}

export function toDataUri(photo: Photo) {
  return `data:${photo.mime};base64,${photo.buffer.toString("base64")}`;
}
