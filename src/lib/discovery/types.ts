/**
 * Discovery Engine — shared types.
 *
 * Every discovery plugin, the mission runner, the duplicate checker,
 * and the admin review UI import from this file only. Nothing in
 * here talks to Prisma, the network, or the DOM — this is the pure
 * contract layer everything else is built on.
 *
 * Field names in ImportedTitle / AvailabilityImport intentionally
 * mirror prisma/schema.prisma (Title / Availability) 1:1 so mapping
 * an import result onto a create/update payload never needs a
 * translation layer. If the schema changes, this file should be the
 * first thing updated.
 */

import type { LogEntry } from "./logger";

// ---------------------------------------------------------------------------
// Sources & missions
// ---------------------------------------------------------------------------

/** A site/platform a plugin knows how to discover and import from. */
export type DiscoverySource =
  | "VerticalDrama"
  | "DramaBox"
  | "ReelShort"
  | "ShortMax"
  | "Unknown";

/** The strategy used to decide *which* titles to discover from a source. */
export type DiscoveryMission =
  | "topCharts"
  | "latest"
  | "genre"
  | "mood"
  | "search"
  | "manualUrls";

/** What to do when a discovered title looks like one we already have. */
export type DuplicatePolicy = "skip" | "review" | "import";

/** Whether imported titles land as drafts or go straight to published. */
export type ImportMode = "draft" | "publish";

// These mirror the Prisma enums exactly (Pacing, TitleStatus, PriceModel).
// Re-declared here rather than imported from @/generated/prisma so this
// package stays importable from anything that shouldn't need a Prisma
// client in scope (e.g. a future standalone worker).
export type Pacing = "fast" | "medium" | "slow";
export type TitleStatus = "ongoing" | "completed" | "cancelled";
export type PriceModel = "free" | "pay_per_unlock" | "subscription" | "ad_supported";

// ---------------------------------------------------------------------------
// Requesting a discovery run
// ---------------------------------------------------------------------------

export interface DiscoveryRequest {
  source: DiscoverySource;
  mission: DiscoveryMission;

  /** How many titles to attempt to discover in this run. */
  quantity: number;

  /** Required when mission === "genre". */
  genre?: string;
  /** Required when mission === "mood". */
  mood?: string;
  /** Required when mission === "search". */
  search?: string;
  /** Required when mission === "manualUrls" — URLs an admin specifically chose, not auto-discovered. */
  urls?: string[];

  duplicatePolicy: DuplicatePolicy;
  importMode: ImportMode;
}

// ---------------------------------------------------------------------------
// What a plugin hands back
// ---------------------------------------------------------------------------

/** One title-like URL found during the discovery phase, not yet imported. */
export interface DiscoveryItem {
  titleUrl: string;
  source: DiscoverySource;
}

/**
 * A field-for-field draft of a Title row.
 *
 * Every field is optional. If a plugin cannot confidently extract a
 * field from the source page, it is omitted (left undefined) — never
 * filled with a guess or a placeholder. Downstream, an omitted field
 * renders as a blank form field for a human to fill in during review,
 * rather than silently writing false data.
 */
export interface ImportedTitle {
  name?: string;
  synopsis?: string;
  language?: string;
  countryOfOrigin?: string;

  tropeTags?: string[];
  moodTags?: string[];
  pacing?: Pacing;
  castType?: string;

  episodeCount?: number;
  avgEpisodeSeconds?: number;

  releaseDate?: string; // ISO 8601 date; parsed at the import boundary, not here.
  status?: TitleStatus;

  coverImageUrl?: string;
}

/**
 * A field-for-field draft of one Availability row.
 * priceModel has no schema default worth assuming — if a plugin can't
 * tell free from pay-per-unlock from subscription, it's left undefined
 * and the reviewer picks it, same as any other missing field.
 */
export interface AvailabilityImport {
  platform: string;
  deepLinkUrl: string;
  priceModel?: PriceModel;
  priceAmountCents?: number;
  currency?: string;
  regionAvailability?: string[];
}

/** One field a plugin could not extract with confidence. */
export interface ImportWarning {
  field: string;
  message: string;
}

/**
 * The full result of importing a single discovered URL.
 * `missingFields` and `warnings` are what drive the "leave blank
 * rather than guess" review UI — every gap is named, not hidden.
 */
export interface ImportResult {
  sourceUrl: string;
  source: DiscoverySource;

  /** 0–1. How confident the plugin is in the extraction as a whole. */
  confidence: number;

  title: ImportedTitle;
  availability?: AvailabilityImport;

  /** Keys of ImportedTitle (or "availability") the plugin could not fill in. */
  missingFields: string[];
  warnings: ImportWarning[];
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export interface DuplicateResult {
  isDuplicate: boolean;
  /** 0–1 similarity score against the closest existing Title. */
  score: number;
  existingTitleId?: string;
  existingTitleName?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Running a full mission
// ---------------------------------------------------------------------------

export interface ImportedDiscoveryItem {
  result: ImportResult;
  duplicate: DuplicateResult;
  imported: boolean;
  skipped: boolean;
  failure?: string;
}

export interface DiscoverySummary {
  totalDiscovered: number;
  imported: number;
  skipped: number;
  failed: number;
  duplicates: number;
  durationMs: number;
}

export interface DiscoveryRunResult {
  summary: DiscoverySummary;
  items: ImportedDiscoveryItem[];
  /** Set when the discovery phase itself failed (e.g. a plugin that's unimplemented for this source, or a mission it doesn't support) — distinct from a per-item failure, which lands on that item instead. A genuinely empty-but-successful run has this unset. */
  error?: string;
  /** Every log line from this run, in order — the mission logger's buffer, actually surfaced. See MissionLogger.getEntries(). */
  logs: LogEntry[];
}

// ---------------------------------------------------------------------------
// The plugin contract
// ---------------------------------------------------------------------------

/**
 * Every source (VerticalDrama, DramaBox, ...) implements this and
 * registers itself with the registry (registry.ts, next up). The
 * mission runner never imports a plugin directly — it only ever
 * talks to this interface.
 */
export interface DiscoveryPlugin {
  readonly source: DiscoverySource;

  /** Does this plugin know how to handle URLs from this domain? */
  supports(url: string): boolean;

  /** Find candidate title URLs for the given request. Does not import. */
  discover(request: DiscoveryRequest): Promise<DiscoveryItem[]>;

  /** Fetch + extract a single URL into an ImportResult. */
  importTitle(url: string): Promise<ImportResult>;
}
