/**
 * Slayd va flayerlar uchun bepul real fotolar. Manbalar navbat bilan sinab ko'riladi:
 * 1) Pexels (PEXELS_API_KEY berilsa) — sifatli stok fotolar
 * 2) Pixabay (PIXABAY_API_KEY berilsa) — sifatli stok fotolar
 * 3) Openverse — kalitsiz, Flickr va boshqa saytlardagi CC litsenziyali fotolar
 * 4) Wikimedia Commons — kalitsiz, oxirgi zaxira
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

export interface PhotoKeys {
  pexels?: string;
  pixabay?: string;
}

type Orientation = "landscape" | "portrait" | "square";

interface Candidate {
  url: string;
  width: number;
  height: number;
  credit: string;
}

interface Provider {
  name: string;
  search: (query: string, orientation: Orientation, keys: PhotoKeys) => Promise<Candidate[]>;
  /** Kalit kerak bo'lsa va berilmagan bo'lsa false */
  enabled: (keys: PhotoKeys) => boolean;
}

const USER_AGENT = "TayyorAI-bot/0.2 (Telegram bot; https://github.com/odilbekjon/TayyorAi)";
const TIMEOUT = 15_000;
/** Juda katta fayllar slaydni og'irlashtiradi */
const MAX_BYTES = 6 * 1024 * 1024;

class HttpError extends Error {
  constructor(host: string, status: number) {
    super(`${host} HTTP ${status}`);
  }
}

async function getJson<T>(url: URL, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new HttpError(url.host, res.status);
  return (await res.json()) as T;
}

/** Faylning birinchi baytlariga qarab turini aniqlaydi (sarlavhaga ishonmaymiz) */
function sniffMime(buf: Buffer): Photo["mime"] | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

async function download(c: Candidate): Promise<Photo | null> {
  const res = await fetch(c.url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new HttpError(new URL(c.url).host, res.status);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = sniffMime(buffer);
  if (!mime || buffer.length > MAX_BYTES) return null;
  return { buffer, mime, width: c.width, height: c.height, credit: c.credit };
}

const pexels: Provider = {
  name: "Pexels",
  enabled: (k) => Boolean(k.pexels),
  async search(query, orientation, keys) {
    const url = new URL("https://api.pexels.com/v1/search");
    url.search = new URLSearchParams({ query, per_page: "6", orientation }).toString();
    const body = await getJson<{
      photos?: Array<{ src: { large: string }; photographer: string; width: number; height: number }>;
    }>(url, { Authorization: keys.pexels! });
    return (body.photos ?? []).map((p) => ({
      url: p.src.large, width: p.width, height: p.height, credit: `Foto: ${p.photographer} / Pexels`,
    }));
  },
};

const pixabay: Provider = {
  name: "Pixabay",
  enabled: (k) => Boolean(k.pixabay),
  async search(query, orientation, keys) {
    const url = new URL("https://pixabay.com/api/");
    url.search = new URLSearchParams({
      key: keys.pixabay!,
      q: query.slice(0, 100),
      image_type: "photo",
      // Pixabay'da "square" yo'q
      orientation: orientation === "portrait" ? "vertical" : orientation === "landscape" ? "horizontal" : "all",
      safesearch: "true",
      per_page: "6",
    }).toString();
    const body = await getJson<{
      hits?: Array<{ largeImageURL: string; imageWidth: number; imageHeight: number; user: string }>;
    }>(url);
    return (body.hits ?? []).map((h) => ({
      url: h.largeImageURL, width: h.imageWidth, height: h.imageHeight, credit: `Foto: ${h.user} / Pixabay`,
    }));
  },
};

function licenseLabel(license: string, version?: string) {
  if (license === "cc0" || license === "pdm") return "Public Domain";
  return `CC ${license.toUpperCase()}${version ? ` ${version}` : ""}`;
}

const openverse: Provider = {
  name: "Openverse",
  enabled: () => true,
  async search(query, orientation) {
    const url = new URL("https://api.openverse.org/v1/images/");
    url.search = new URLSearchParams({
      q: query,
      page_size: "10",
      category: "photograph",
      aspect_ratio: orientation === "landscape" ? "wide" : orientation === "portrait" ? "tall" : "square",
      mature: "false",
    }).toString();
    const body = await getJson<{
      results?: Array<{
        url: string; width?: number; height?: number; filetype?: string;
        creator?: string; license: string; license_version?: string;
      }>;
    }>(url);
    return (body.results ?? [])
      .filter((r) => r.width && r.height && r.width <= 4000 && (!r.filetype || /^(jpe?g|png)$/i.test(r.filetype)))
      .map((r) => ({
        url: r.url, width: r.width!, height: r.height!,
        credit: `Foto: ${r.creator ? `${r.creator}, ` : ""}${licenseLabel(r.license, r.license_version)}`,
      }));
  },
};

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

const wikimedia: Provider = {
  name: "Wikimedia",
  enabled: () => true,
  async search(query) {
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
    const body = await getJson<{ query?: { pages?: Record<string, CommonsPage> } }>(url);
    return Object.values(body.query?.pages ?? {})
      .sort((a, b) => a.index - b.index)
      .flatMap((page) => {
        const info = page.imageinfo?.[0];
        if (!info?.thumburl || !info.thumbwidth || !info.thumbheight) return [];
        if (info.mime !== "image/jpeg" && info.mime !== "image/png") return [];
        const license = info.extmetadata?.LicenseShortName?.value;
        return [{
          url: info.thumburl, width: info.thumbwidth, height: info.thumbheight,
          credit: `Rasm: Wikimedia Commons${license ? `, ${license}` : ""}`,
        }];
      });
  },
};

const PROVIDERS = [pexels, pixabay, openverse, wikimedia];

/** Bir xil xato loglarni to'ldirib yubormasligi uchun har biri 10 daqiqada bir marta yoziladi */
const lastWarned = new Map<string, number>();
function warn(provider: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const key = `${provider}:${msg}`;
  if (Date.now() - (lastWarned.get(key) ?? 0) < 10 * 60_000) return;
  lastWarned.set(key, Date.now());
  console.warn(`[photos] ${provider}: ${msg}`);
}

/**
 * Ishlamay qolgan manba 5 daqiqa chetlab o'tiladi: aks holda 12 slaydli taqdimotda
 * har bir slayd uchun 15 soniyalik timeout kutilib, ish bir necha daqiqaga cho'ziladi.
 */
const downUntil = new Map<string, number>();
const COOLDOWN = 5 * 60_000;

async function tryProvider(p: Provider, query: string, orientation: Orientation, keys: PhotoKeys, used: Set<string>) {
  const candidates = await p.search(query, orientation, keys);
  // Birinchi 3 ta nomzoddan birortasi yuklanmasa, keyingi manbaga o'tamiz
  for (const c of candidates.filter((c) => !used.has(c.url)).slice(0, 3)) {
    const photo = await download(c).catch((err) => (warn(p.name, err), null));
    if (photo) {
      used.add(c.url);
      return photo;
    }
  }
  return null;
}

/**
 * Bir hujjat ichida bir xil rasm takrorlanmasligi uchun `used` to'plamini
 * barcha chaqiruvlarda bitta qilib uzating. Topilmasa null (xato tashlamaydi).
 */
export async function findPhoto(
  query: string,
  opts: { keys?: PhotoKeys; orientation?: Orientation; used?: Set<string> } = {},
): Promise<Photo | null> {
  const used = opts.used ?? new Set<string>();
  const keys = opts.keys ?? {};
  const photo = await searchAll(query, opts.orientation ?? "landscape", keys, used);
  if (photo) return photo;
  // "renewable energy wind turbines" topilmasa, "renewable energy" bilan yana urinib ko'ramiz
  const words = query.trim().split(/\s+/);
  return words.length > 2 ? searchAll(words.slice(0, 2).join(" "), opts.orientation ?? "landscape", keys, used) : null;
}

async function searchAll(query: string, orientation: Orientation, keys: PhotoKeys, used: Set<string>) {
  for (const p of PROVIDERS.filter((p) => p.enabled(keys) && (downUntil.get(p.name) ?? 0) < Date.now())) {
    try {
      const photo = await tryProvider(p, query, orientation, keys, used);
      if (photo) return photo;
    } catch (err) {
      warn(p.name, err);
      downUntil.set(p.name, Date.now() + COOLDOWN);
    }
  }
  return null;
}

/** Admin uchun: har bir manba hozir ishlayaptimi (/rasm buyrug'i) */
export async function checkPhotoProviders(keys: PhotoKeys, query = "mountain lake") {
  return Promise.all(
    PROVIDERS.map(async (p) => {
      if (!p.enabled(keys)) return { name: p.name, ok: false, detail: "kalit berilmagan" };
      const started = Date.now();
      try {
        const photo = await tryProvider(p, query, "landscape", keys, new Set());
        const ms = Date.now() - started;
        return photo
          ? { name: p.name, ok: true, detail: `${photo.width}x${photo.height}, ${Math.round(photo.buffer.length / 1024)} KB, ${ms} ms` }
          : { name: p.name, ok: false, detail: `rasm topilmadi yoki yuklanmadi (${ms} ms)` };
      } catch (err) {
        return { name: p.name, ok: false, detail: err instanceof Error ? err.message : String(err) };
      }
    }),
  );
}

export function toDataUri(photo: Photo) {
  return `data:${photo.mime};base64,${photo.buffer.toString("base64")}`;
}
