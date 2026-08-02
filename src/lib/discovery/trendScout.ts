"use server";

/**
 * Discovery Engine — Trend Scout.
 *
 * Deliberately does NOT touch ReelShort/DramaBox/ShortMax directly —
 * see ARCHITECTURE.md's Discovery Engine section for why automated
 * crawling of those platforms' own listing pages was removed. This
 * surfaces *awareness* signal instead: what's being talked about
 * right now, from sources that are actually meant to be read this
 * way. It never creates or imports a Title on its own — an admin
 * still reads a signal, decides it's worth pursuing, finds the real
 * platform link themselves, and pastes it into the existing
 * "manualUrls" mission. This module's whole job stops at "here's
 * what's buzzing" — nothing here mutates the catalogue.
 *
 * Two sources, two different honesty caveats worth keeping visible
 * rather than papering over:
 *
 * - Reddit's `search.rss` endpoint is real and public, but explicitly
 *   meant for light/casual use, not sustained polling — Reddit's own
 *   API access now requires an approved application under their
 *   Responsible Builder Policy, and this deliberately does NOT try to
 *   route around that with the unauthenticated endpoint at volume.
 *   Caching + a floor on how often a query can actually hit the
 *   network (see CACHE_TTL_MS) keeps this to "an admin clicks a
 *   button occasionally," not polling.
 * - Google News' own terms discourage scraping/republishing its
 *   content elsewhere. This is read into an admin-only internal
 *   dashboard and never displayed to end users or republished
 *   anywhere — closer to an admin personally using an RSS reader than
 *   a competing product — but that's a judgment call, not a
 *   guarantee, and is worth revisiting if this ever stops being
 *   admin-only.
 */

import { requireAdmin } from "@/lib/admin";
import { fetchXml } from "./webExtract";
import { parseAtom, parseRss2, type FeedItem } from "./rss";

export type TrendSource = "reddit" | "press";

export interface TrendSignal {
  title: string;
  url: string;
  source: TrendSource;
  snippet: string | null;
  publishedAt: string | null;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes — keeps repeated admin clicks from re-hitting Reddit/Google every time
const cache = new Map<string, { items: TrendSignal[]; fetchedAt: number }>();

const DEFAULT_QUERY = "vertical drama app";

function toSignals(items: FeedItem[], source: TrendSource): TrendSignal[] {
  return items.map((item) => ({
    title: item.title,
    url: item.link,
    source,
    snippet: item.snippet,
    publishedAt: item.publishedAt,
  }));
}

async function fetchRedditSignal(query: string): Promise<TrendSignal[]> {
  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&sort=new&limit=15&t=week`;
  const xml = await fetchXml(url);
  if (!xml) return [];
  return toSignals(parseAtom(xml), "reddit");
}

async function fetchPressSignal(query: string): Promise<TrendSignal[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchXml(url);
  if (!xml) return [];
  return toSignals(parseRss2(xml), "press");
}

function dedupeAndSort(signals: TrendSignal[]): TrendSignal[] {
  const seen = new Set<string>();
  const deduped: TrendSignal[] = [];
  for (const signal of signals) {
    if (seen.has(signal.url)) continue;
    seen.add(signal.url);
    deduped.push(signal);
  }
  return deduped.sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

/**
 * Returns cached results for this exact query if fetched within the
 * last CACHE_TTL_MS, otherwise fetches fresh from both sources.
 * Never throws — a source that fails just contributes nothing rather
 * than failing the whole scan.
 */
export async function getTrendSignals(query?: string): Promise<TrendSignal[]> {
  await requireAdmin();

  const q = query?.trim() || DEFAULT_QUERY;
  const cached = cache.get(q);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const [reddit, press] = await Promise.all([fetchRedditSignal(q), fetchPressSignal(q)]);
  const items = dedupeAndSort([...reddit, ...press]);

  cache.set(q, { items, fetchedAt: Date.now() });
  return items;
}
