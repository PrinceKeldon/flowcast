/**
 * ReelShort (Crazy Maple Studio) discovery plugin.
 *
 * reelshort.com's public web catalogue is server-rendered plain HTML
 * (confirmed by fetching it directly — no JS execution needed) and is
 * the site's own promotional listing, not a paywalled or licensed
 * dataset — a legitimate discovery target, unlike verticaldrama.tv.
 *
 * URL shapes observed directly on the live site (2026-07-31):
 *   Shelf/listing page: https://www.reelshort.com/shelf/<slug>-<id>
 *   Title/episode page: https://www.reelshort.com/episodes/<encoded-path>
 * There is no separate "show page" distinct from the episode-1 URL —
 * the episode-1 link IS the canonical destination for a title, so
 * that's what's used as both the discovery item and the deep link.
 */

import type { DiscoveryItem, DiscoveryPlugin, DiscoveryRequest, ImportResult } from "../types";
import { extractLinks, fetchHtml, fetchPageMeta } from "../webExtract";
import { buildResultFromMeta } from "./buildResult";

const BASE = "https://www.reelshort.com";

// Only the two shelves discoverable without knowing genre/mood slug
// IDs ahead of time. "genre"/"mood"/"search" missions aren't wired up
// yet — see the thrown error below rather than a wrong guess.
const SHELF_BY_MISSION: Partial<Record<DiscoveryRequest["mission"], string>> = {
  topCharts: `${BASE}/shelf/top-short-movies-dramas-51001122`,
  latest: `${BASE}/shelf/new-release-short-movies-dramas-51001121`,
};

const EPISODE_HREF_PATTERN = /^\/episodes\//;

export const reelShortPlugin: DiscoveryPlugin = {
  source: "ReelShort",

  supports(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith("reelshort.com");
    } catch {
      return false;
    }
  },

  async discover(request: DiscoveryRequest): Promise<DiscoveryItem[]> {
    const shelfUrl = SHELF_BY_MISSION[request.mission];
    if (!shelfUrl) {
      throw new Error(
        `ReelShort plugin doesn't support mission "${request.mission}" yet — only "topCharts" and "latest" are wired to a known shelf URL.`
      );
    }

    const html = await fetchHtml(shelfUrl);
    if (!html) {
      throw new Error(`Could not fetch ReelShort shelf page: ${shelfUrl}`);
    }
    const links = extractLinks(html, shelfUrl, EPISODE_HREF_PATTERN);

    return links.map((titleUrl) => ({ titleUrl, source: "ReelShort" as const }));
  },

  async importTitle(url: string): Promise<ImportResult> {
    const meta = await fetchPageMeta(url);
    return buildResultFromMeta(url, "ReelShort", meta, "ReelShort", url);
  },
};
