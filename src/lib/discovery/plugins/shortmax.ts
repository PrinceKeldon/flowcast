/**
 * ShortMax (SHORTTV LIMITED) discovery plugin.
 *
 * Official web domain confirmed via ShortMax's own Google Play
 * listing ("Official Website: https://www.shorttv.live/") — several
 * lookalike/mirror domains exist for this platform and were
 * deliberately not used.
 *
 * URL shapes observed directly on the live site (2026-07-31):
 *   Title/show page:  https://www.shorttv.live/drama/<slug>-<id>
 *   Episode page:      https://www.shorttv.live/episode/<slug>-<id>-<epNum>
 * The homepage itself lists dozens of genre shelves each linking to
 * /drama/ pages — no separate "top chart" URL was found, so both
 * "topCharts" and "latest" missions currently read the homepage.
 * Genre-scoped discovery isn't wired up (see the thrown error).
 */

import type { DiscoveryItem, DiscoveryPlugin, DiscoveryRequest, ImportResult } from "../types";
import { extractLinks, fetchHtml, fetchPageMeta } from "../webExtract";
import { buildResultFromMeta } from "./buildResult";

const BASE = "https://www.shorttv.live";
const DRAMA_HREF_PATTERN = /^\/drama\//;

export const shortMaxPlugin: DiscoveryPlugin = {
  source: "ShortMax",

  supports(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith("shorttv.live");
    } catch {
      return false;
    }
  },

  async discover(request: DiscoveryRequest): Promise<DiscoveryItem[]> {
    if (request.mission !== "topCharts" && request.mission !== "latest") {
      throw new Error(
        `ShortMax plugin doesn't support mission "${request.mission}" yet — only "topCharts" and "latest" (both read the homepage) are wired up.`
      );
    }

    const html = await fetchHtml(`${BASE}/`);
    if (!html) {
      throw new Error(`Could not fetch ShortMax homepage: ${BASE}/`);
    }
    const links = extractLinks(html, `${BASE}/`, DRAMA_HREF_PATTERN);

    return links.map((titleUrl) => ({ titleUrl, source: "ShortMax" as const }));
  },

  async importTitle(url: string): Promise<ImportResult> {
    const meta = await fetchPageMeta(url);
    return buildResultFromMeta(url, "ShortMax", meta, "ShortMax", url);
  },
};
