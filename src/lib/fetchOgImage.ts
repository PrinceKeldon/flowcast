"use server";

import { requireAdmin } from "@/lib/admin";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 200_000; // og tags live in <head>, never need the whole page

export interface FetchOgImageResult {
  imageUrl: string | null;
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

function extractMetaImage(html: string, baseUrl: URL): string | null {
  const patterns = [
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Fetches a page and pulls a cover image out of its og:image/twitter:image
 * meta tags — the same mechanism link-preview bots (Slack, Twitter,
 * iMessage) use. Admin-only, and deliberately doesn't always succeed:
 * some platforms are far more app-native than web-native and their
 * public pages may not carry real metadata at all. When that happens,
 * the caller falls back to pasting a URL manually — same field either
 * way, this just tries to save a step.
 */
export async function fetchOgImage(rawUrl: string): Promise<FetchOgImageResult> {
  await requireAdmin();

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { imageUrl: null, error: "Not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { imageUrl: null, error: "URL must be http or https." };
  }
  if (isBlockedHost(url.hostname)) {
    return { imageUrl: null, error: "That host isn't fetchable." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KiligBot/1.0; admin cover-art lookup)",
      },
    });

    if (!res.ok) {
      return { imageUrl: null, error: `Page returned ${res.status}.` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { imageUrl: null, error: "That URL isn't an HTML page." };
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

    const imageUrl = extractMetaImage(html, url);
    if (!imageUrl) {
      return { imageUrl: null, error: "No og:image found on that page." };
    }
    return { imageUrl };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { imageUrl: null, error: "Timed out fetching that page." };
    }
    return { imageUrl: null, error: "Couldn't fetch that page." };
  } finally {
    clearTimeout(timeout);
  }
}
