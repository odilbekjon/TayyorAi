/** Pexels'dan bepul rasm topib, base64 ko'rinishda qaytaradi. Topilmasa null. */
export async function findPhoto(apiKey: string, query: string): Promise<string | null> {
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");

    const res = await fetch(url, { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { photos?: Array<{ src: { large: string } }> };
    const src = body.photos?.[0]?.src.large;
    if (!src) return null;

    const img = await fetch(src, { signal: AbortSignal.timeout(15_000) });
    if (!img.ok) return null;
    const buf = Buffer.from(await img.arrayBuffer());
    return `image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
