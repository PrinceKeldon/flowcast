import type { DiscoverySource, ImportResult, ImportWarning } from "../types";
import type { PageMeta } from "../webExtract";

/**
 * Turns a fetched PageMeta into an ImportResult. Shared by every
 * og-tag-based plugin (ReelShort, ShortMax, and future ones) so
 * "which fields count as missing" and "how confidence is scored"
 * stay defined in exactly one place.
 *
 * platform/deepLinkUrl are passed separately from meta because not
 * every plugin wants the *fetched* URL as the deep link (a plugin
 * might fetch a detail page but deep-link to a canonical shorter
 * URL) — callers decide.
 */
export function buildResultFromMeta(
  sourceUrl: string,
  source: DiscoverySource,
  meta: PageMeta | null,
  platform: string,
  deepLinkUrl: string
): ImportResult {
  const missingFields: string[] = [];
  const warnings: ImportWarning[] = [];

  if (!meta) {
    warnings.push({ field: "*", message: "Could not fetch or parse the page." });
    return {
      sourceUrl,
      source,
      confidence: 0,
      title: {},
      missingFields: ["name", "synopsis", "coverImageUrl", "language"],
      warnings,
    };
  }

  if (!meta.title) missingFields.push("name");
  if (!meta.description) missingFields.push("synopsis");
  if (!meta.imageUrl) missingFields.push("coverImageUrl");
  // language is never inferred from og-tags — a page being in English
  // doesn't mean the *content* is English-original vs. dubbed/subbed,
  // and getting this wrong silently writes a wrong fact rather than
  // an absent one. Always left for review.
  missingFields.push("language");
  warnings.push({ field: "language", message: "Language cannot be determined from page metadata — leaving blank for review." });

  const filledCount = 3 - missingFields.filter((f) => f !== "language").length; // name/synopsis/coverImageUrl out of 3
  const confidence = filledCount / 3;

  return {
    sourceUrl,
    source,
    confidence,
    title: {
      name: meta.title ?? undefined,
      synopsis: meta.description ?? undefined,
      coverImageUrl: meta.imageUrl ?? undefined,
    },
    availability: {
      platform,
      deepLinkUrl,
      // priceModel intentionally omitted — see AvailabilityImport docstring in types.ts.
    },
    missingFields,
    warnings,
  };
}
