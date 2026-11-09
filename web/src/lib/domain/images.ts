// Accept only photos uploaded to our Vercel Blob store. Pure.
export function cleanImages(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const u of input) {
    if (typeof u !== "string" || u.length > 500) continue;
    try {
      const url = new URL(u);
      if (url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") && !out.includes(u)) out.push(u);
    } catch {
      /* skip */
    }
    if (out.length >= max) break;
  }
  return out;
}
