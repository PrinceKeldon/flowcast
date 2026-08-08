/**
 * ReelShort (Crazy Maple Studio) discovery plugin.
 *
 * discover() only supports mission "manualUrls" — an admin-chosen
 * list of ReelShort links, not automated crawling of ReelShort's own
 * shelf/listing pages. An earlier version of this file fetched
 * https://www.reelshort.com/shelf/... and regex-extracted every
 * /episodes/ link on it to enumerate a batch of titles automatically;
 * that's scraping a platform's own catalog regardless of how
 * politely it's implemented, almost certainly runs against
 * ReelShort's Terms of Service (standard boilerplate against
 * automated crawling on nearly every consumer platform), and is a
 * direct risk to the exact relationship this product's "watch on"
 * deep-linking depends on. Removed entirely, not left reachable
 * behind a flag.
 *
 * importTitle() is unchanged — fetching one page a human specifically
 * chose, reading its own og:/twitter: meta tags, was never the
 * problem; only automated multi-title enumeration was.
 */

import type { DiscoveryItem, DiscoveryPlugin, DiscoveryRequest, ImportResult } from "../types";
import { fetchPageMeta } from "../webExtract";
import { buildResultFromMeta } from "./buildResult";

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
    if (request.mission !== "manualUrls") {
      throw new Error(
        `ReelShort plugin only supports mission "manualUrls" — pass in the URLs an admin specifically chose. Automated discovery from ReelShort's own listing pages was deliberately removed (see this file's docstring).`
      );
    }

    const urls = request.urls ?? [];
    const matched = urls.filter((url) => reelShortPlugin.supports(url));
    if (urls.length > 0 && matched.length === 0) {
      // Every pasted URL got dropped by supports() — almost always
      // means the wrong Source is selected for these links (e.g.
      // ShortMax URLs pasted while "ReelShort" is picked). Throwing
      // here, rather than returning [], is what makes this show up
      // as a real error in the admin UI instead of a bare "0
      // discovered" that looks identical to a genuinely empty run.
      throw new Error(
        `None of the ${urls.length} pasted URL(s) are reelshort.com links. Check you selected the right Source for these links.`
      );
    }
    return matched.slice(0, request.quantity).map((titleUrl) => ({ titleUrl, source: "ReelShort" as const }));
  },

  async importTitle(url: string): Promise<ImportResult> {
    const meta = await fetchPageMeta(url);
    return buildResultFromMeta(url, "ReelShort", meta, "ReelShort", url);
  },
};
