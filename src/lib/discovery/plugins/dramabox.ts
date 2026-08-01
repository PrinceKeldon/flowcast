/**
 * DramaBox (StoryMatrix Pte. Ltd.) discovery plugin — INTENTIONALLY
 * NOT IMPLEMENTED.
 *
 * A direct fetch against dramabox.com's own /browse page returned an
 * explicit bot-detection block (tested 2026-07-31, not a guess or a
 * timeout). That's a concrete, observed anti-scraping measure, not
 * an assumption — the honest response is to not attempt to defeat
 * it, not to build around it with a headless browser + fingerprint
 * evasion. That would cross from "reading a public page" into
 * deliberately circumventing an access control, which this engine
 * doesn't do for any source.
 *
 * This plugin is still registered — supports() correctly claims
 * DramaBox URLs — so the admin UI can show DramaBox as "known but
 * unavailable" instead of silently missing, and a title pasted
 * manually via the existing single-URL fetchTitleMetadata tool can
 * still be entered by hand the normal way. If DramaBox ever offers
 * an official data partnership or API, that's what this file should
 * be rewritten against.
 */

import type { DiscoveryItem, DiscoveryPlugin, DiscoveryRequest, ImportResult } from "../types";

const UNAVAILABLE_MESSAGE =
  "DramaBox blocks automated fetches (confirmed bot-detection response, not a guess). " +
  "Bulk discovery for this source isn't implemented — add titles via the manual admin form instead.";

export const dramaBoxPlugin: DiscoveryPlugin = {
  source: "DramaBox",

  supports(url: string): boolean {
    try {
      return new URL(url).hostname.includes("dramabox");
    } catch {
      return false;
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by DiscoveryPlugin
  async discover(_request: DiscoveryRequest): Promise<DiscoveryItem[]> {
    throw new Error(UNAVAILABLE_MESSAGE);
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by DiscoveryPlugin
  async importTitle(_url: string): Promise<ImportResult> {
    throw new Error(UNAVAILABLE_MESSAGE);
  },
};
