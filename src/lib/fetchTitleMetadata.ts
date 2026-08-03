"use server";

import { requireAdmin } from "@/lib/admin";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 400_000; // was head-only (200KB); episode-count extraction needs body text too now

export interface TitleMetadataResult {
  name: string | null;
  synopsis: string | null;
  coverImageUrl: string | null;
  platformGuess: string | null;
  episodeCount: number | null;
  /**
   * How episodeCount was found, so the admin form can show honest
   * confidence rather than presenting a text-pattern guess with the
   * same weight as a structured-data hit. null when episodeCount is
   * also null.
   */
  episodeCountSource: "structured" | "text-pattern" | null;
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
 * Structured-data episode count — schema.org's numberOfEpisodes on a
 * TVSeries/CreativeWorkSeries JSON-LD block, when a platform bothers
 * to include one. Genuinely reliable when present, unlike the text
 * fallback below, because it's the platform explicitly stating a
 * count in machine-readable form rather than us guessing at prose.
 */
function extractEpisodeCountFromJsonLd(html: string): number | null {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  for (const block of blocks) {
    const jsonMatch = block.match(/>([\s\S]*?)<\/script>/i);
    if (!jsonMatch?.[1]) continue;

    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of candidates) {
        const count = entry?.numberOfEpisodes;
        if (typeof count === "number" && count > 0) return Math.round(count);
        if (typeof count === "string" && /^\d+$/.test(count)) return parseInt(count, 10);
      }
    } catch {
      // Malformed JSON-LD is common enough on real sites not to treat
      // as a fetch failure — just skip this block and keep looking.
      continue;
    }
  }
  return null;
}

/**
 * Best-effort text-pattern fallback for when there's no structured
 * data: looks for phrasing like "24 Episodes" / "Total: 24 episodes"
 * in the page's visible text. Genuinely a guess, not a guarantee —
 * there's no standard for this the way there is for og:title, so this
 * is pattern-matching prose, not reading a declared fact. Callers
 * must treat this as a lower-confidence result than the JSON-LD path
 * (see episodeCountSource on TitleMetadataResult).
 */
function extractEpisodeCountFromText(html: string): number | null {
  const plainText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const match = plainText.match(/\b(\d{1,4})\s*(?:total\s+)?episodes?\b/i);
  if (!match) return null;

  const count = parseInt(match[1], 10);
  // Sanity bound — a match like "2024 episodes" (a year, misfired) or
  // "0 episodes" isn't a real episode count.
  if (count < 1 || count > 2000) return null;
  return count;
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
 *
 * episodeCount is a step down in reliability from the rest: there's
 * no standard meta tag for it the way there is for og:title, so this
 * tries schema.org JSON-LD (numberOfEpisodes) first — genuinely
 * reliable when a platform includes it — and falls back to matching
 * phrasing like "24 Episodes" in the page's visible text, which is a
 * real best-effort guess, not a guarantee. episodeCountSource tells
 * the caller which path produced it, so the admin form can show
 * honest confidence instead of presenting a text-pattern guess with
 * the same weight as a structured-data hit.
 */
export async function fetchTitleMetadata(rawUrl: string): Promise<TitleMetadataResult> {
  await requireAdmin();

  const empty: TitleMetadataResult = {
    name: null,
    synopsis: null,
    coverImageUrl: null,
    platformGuess: null,
    episodeCount: null,
    episodeCountSource: null,
  };

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

    const structuredEpisodeCount = extractEpisodeCountFromJsonLd(html);
    const textEpisodeCount = structuredEpisodeCount === null ? extractEpisodeCountFromText(html) : null;
    const episodeCount = structuredEpisodeCount ?? textEpisodeCount;
    const episodeCountSource: TitleMetadataResult["episodeCountSource"] =
      structuredEpisodeCount !== null ? "structured" : textEpisodeCount !== null ? "text-pattern" : null;

    if (!name && !synopsis && !coverImageUrl && episodeCount === null) {
      return { ...empty, error: "No usable metadata found on that page." };
    }

    return {
      name: name || null,
      synopsis: synopsis || null,
      coverImageUrl,
      platformGuess: siteName,
      episodeCount,
      episodeCountSource,
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
