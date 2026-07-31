"use server";

import { requireAdmin } from "@/lib/admin";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 200_000; // meta tags live in <head>, never need the whole page

export interface TitleMetadataResult {
  name: string | null;
  synopsis: string | null;
  coverImageUrl: string | null;
  platformGuess: string | null;
  error?: string;
}

// Blocks the obvious loopback/private-network hostnames an admin could
// paste by mistake (or a compromised admin session could be tricked
// into fetching). Not exhaustive DNS-rebinding-proof SSRF protection —
// that's disproportionate for a single-admin, requireAdmin()-gated
// tool — just a reasonable first line of defense against the easy
// cases, matching the "lightweight, not enterprise-grade" security
// bar already set elsewhere in lib/admin.ts.
function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "0.0.0.0" || lower === "::1") return true;
  if (/^127\./.test(lower)) return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true; // cloud metadata endpoints
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

function resolveImageUrl(rawUrl: string, baseUrl: URL): string | null {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Fetches a page and pulls whatever a well-built page's own meta tags
 * offer — the same mechanism link-preview bots (Slack, Twitter,
 * iMessage) use to build a card, not an LLM. Deliberately not
 * exhaustive: a synopsis pulled from og:description is written for
 * SEO/marketing, not necessarily Kilig's voice or length, and there's
 * no meta tag for trope/mood tags at all — those still need real
 * editorial judgment. Treat every field this returns as a first draft
 * to review, not a final answer. See admin/titles/new for how the
 * result gets used: it prefills the form, nothing auto-submits.
 */
export async function fetchTitleMetadata(rawUrl: string): Promise<TitleMetadataResult> {
  await requireAdmin();

  const empty: TitleMetadataResult = { name: null, synopsis: null, coverImageUrl: null, platformGuess: null };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ...empty, error: "Not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ...empty, error: "URL must be http or https." };
  }
  if (isBlockedHost(url.hostname)) {
    return { ...empty, error: "That host isn't fetchable." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KiligBot/1.0; admin title lookup)",
      },
    });

    if (!res.ok) {
      return { ...empty, error: `Page returned ${res.status}.` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { ...empty, error: "That URL isn't an HTML page." };
    }

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
        if (html.includes("</head>")) break;
      }
      await reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }

    const ogTitle = extractMetaContent(html, "og:title");
    const plainTitle = extractPlainTitle(html);
    const siteName = extractMetaContent(html, "og:site_name");

    // A bare <title> tag often carries site branding (e.g. "Show Name
    // | ReelShort") that og:title usually doesn't — strip a trailing
    // " | Site" / " - Site" suffix if we also know the site name, so
    // it doesn't leak into the title field.
    let name = ogTitle ?? plainTitle;
    if (name && siteName) {
      const suffixPattern = new RegExp(`\\s*[|\\-–—]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
      name = name.replace(suffixPattern, "").trim();
    }

    const synopsis = extractMetaContent(html, "og:description") ?? extractMetaContent(html, "description");

    const rawImage = extractMetaContent(html, "og:image") ?? extractMetaContent(html, "og:image:secure_url") ??
      extractMetaContent(html, "twitter:image") ?? extractMetaContent(html, "twitter:image:src");
    const coverImageUrl = rawImage ? resolveImageUrl(rawImage, url) : null;

    if (!name && !synopsis && !coverImageUrl) {
      return { ...empty, error: "No usable metadata found on that page." };
    }

    return {
      name: name || null,
      synopsis: synopsis || null,
      coverImageUrl,
      platformGuess: siteName,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ...empty, error: "Timed out fetching that page." };
    }
    return { ...empty, error: "Couldn't fetch that page." };
  } finally {
    clearTimeout(timeout);
  }
}
