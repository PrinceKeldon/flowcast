/**
 * ShortMax (SHORTTV LIMITED) discovery plugin.
 *
 * Same change as reelshort.ts, same reasoning — see that file's
 * docstring. discover() only supports "manualUrls"; the earlier
 * version that fetched shorttv.live's homepage and regex-extracted
 * every /drama/ link on it (automated catalog enumeration) has been
 * removed entirely, not left dormant behind a flag.
 */

import type { DiscoveryItem, DiscoveryPlugin, DiscoveryRequest, ImportResult } from "../types";
import { fetchPageMeta } from "../webExtract";
import { buildResultFromMeta } from "./buildResult";

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
    if (request.mission !== "manualUrls") {
      throw new Error(
        `ShortMax plugin only supports mission "manualUrls" — pass in the URLs an admin specifically chose. Automated discovery from ShortMax's own listing pages was deliberately removed (see this file's docstring).`
      );
    }

    const urls = request.urls ?? [];
    const matched = urls.filter((url) => shortMaxPlugin.supports(url));
    if (urls.length > 0 && matched.length === 0) {
      // Same reasoning as reelshort.ts's identical check — see that
      // file's comment.
      throw new Error(
        `None of the ${urls.length} pasted URL(s) are shorttv.live links. Check you selected the right Source for these links.`
      );
    }
    return matched.slice(0, request.quantity).map((titleUrl) => ({ titleUrl, source: "ShortMax" as const }));
  },

  async importTitle(url: string): Promise<ImportResult> {
    const meta = await fetchPageMeta(url);
    return buildResultFromMeta(url, "ShortMax", meta, "ShortMax", url);
  },
};
