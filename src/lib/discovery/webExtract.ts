/**
 * Discovery Engine — shared web extraction helpers.
 *
 * Deliberately the same "read the page's own meta tags, same as a
 * link-preview bot" mechanism as fetchTitleMetadata.ts (see that
 * file's docstring) — not duplicated by accident, duplicated on
 * purpose so this module has no dependency on an admin-gated server
 * action and plugins can call it directly. If the two ever need to
 * diverge (e.g. one needs JSON-LD parsing the other doesn't), that's
 * a sign they were never really the same function.
 *
 * No AI in this pipeline, on purpose (see the project's own stated
 * rule) — this only ever returns what a page's own markup states.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 300_000;
const USER_AGENT = "Mozilla/5.0 (compatible; KiligDiscoveryBot/1.0; +admin discovery mission)";

export interface PageMeta {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "0.0.0.0" || lower === "::1") return true;
  if (/^127\./.test(lower)) return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  return false;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

function extractPlainTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeEntities(match[1]) : null;
}

function resolveUrl(rawUrl: string, base: URL): string | null {
  try {
    return new URL(rawUrl, base).toString();
  } catch {
    return null;
  }
}

/**
 * Fetches raw HTML for a URL. Bounded by MAX_BYTES / FETCH_TIMEOUT_MS
 * so a single slow or huge page can't stall a whole mission. Returns
 * null (never throws) on any failure — callers decide how to record
 * that against the mission item.
 */
export async function fetchHtml(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isBlockedHost(url.hostname)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    let html = "";
    const reader = res.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytesRead += value.length;
      }
      await reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Pulls og:/twitter: meta tags out of already-fetched HTML. Pure — no network. */
export function extractPageMeta(html: string, pageUrl: string): PageMeta {
  const url = new URL(pageUrl);
  const siteName = extractMetaContent(html, "og:site_name");

  let title = extractMetaContent(html, "og:title") ?? extractPlainTitle(html);
  if (title && siteName) {
    const suffix = new RegExp(`\\s*[|\\-–—]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
    title = title.replace(suffix, "").trim();
  }

  const description =
    extractMetaContent(html, "og:description") ?? extractMetaContent(html, "description");

  const rawImage =
    extractMetaContent(html, "og:image") ??
    extractMetaContent(html, "og:image:secure_url") ??
    extractMetaContent(html, "twitter:image");
  const imageUrl = rawImage ? resolveUrl(rawImage, url) : null;

  return { title: title || null, description: description || null, imageUrl, siteName };
}

/** Fetch + extract in one call — the common case for a plugin's importTitle(). */
export async function fetchPageMeta(url: string): Promise<PageMeta | null> {
  const html = await fetchHtml(url);
  if (!html) return null;
  return extractPageMeta(html, url);
}

/**
 * Pulls every unique absolute (or root-relative, resolved against
 * `base`) href matching `hrefPattern` out of raw HTML, in document
 * order. The generic "find candidate links" building block every
 * plugin's discover() uses against a listing/shelf page.
 */
export function extractLinks(html: string, base: string, hrefPattern: RegExp): string[] {
  const baseUrl = new URL(base);
  const seen = new Set<string>();
  const anchorRe = /<a\s[^>]*href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const href = decodeEntities(match[1]);
    if (!hrefPattern.test(href)) continue;
    const resolved = resolveUrl(href, baseUrl);
    if (resolved) seen.add(resolved);
  }
  return Array.from(seen);
}
