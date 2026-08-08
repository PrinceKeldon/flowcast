"use server";

/**
 * Discovery Engine — mission runner.
 *
 * The one function the admin UI actually calls. Everything else in
 * this directory exists to support this: pick the plugin (registry),
 * discover candidate URLs, import each one, check it against the
 * existing catalogue (duplicate.ts), and — only when the result is
 * both non-duplicate (or explicitly overridden) and has every field
 * Title/Availability require — persist it via the existing
 * createTitle/addAvailability admin actions, so mission-created rows
 * go through exactly the same validation and tag-registration path as
 * a title entered by hand.
 *
 * One failed item never aborts the run: each DiscoveryItem is
 * processed independently and its own failure is recorded on itself.
 */

import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/admin";
import { createTitle, addAvailability } from "@/lib/actions";
import "./registry-init"; // side-effect: registers every plugin (see that file)
import { getPlugin, listSources } from "./registry";
import { checkDuplicate } from "./duplicate";
import { MissionLogger } from "./logger";
import type {
  DiscoveryRequest,
  DiscoveryRunResult,
  DiscoverySource,
  ImportedDiscoveryItem,
  ImportResult,
} from "./types";

const REQUIRED_TITLE_FIELDS = ["name", "language"] as const;

/** Which ImportedTitle fields are missing to satisfy Title's NOT NULL columns. */
function missingRequiredTitleFields(result: ImportResult): string[] {
  return REQUIRED_TITLE_FIELDS.filter((field) => {
    const value = result.title[field];
    return value === undefined || value === null || value === "";
  });
}

async function persistImportResult(result: ImportResult): Promise<{ titleId: string }> {
  const missing = missingRequiredTitleFields(result);
  if (missing.length > 0) {
    throw new Error(`Cannot create title — missing required field(s): ${missing.join(", ")}`);
  }

  const title = await createTitle({
    name: result.title.name!,
    synopsis: result.title.synopsis,
    language: result.title.language!,
    countryOfOrigin: result.title.countryOfOrigin,
    tropeTags: result.title.tropeTags ?? [],
    moodTags: result.title.moodTags ?? [],
    pacing: result.title.pacing,
    castType: result.title.castType,
    episodeCount: result.title.episodeCount,
    coverImageUrl: result.title.coverImageUrl,
    isPublished: false, // mission-created titles always land unpublished, regardless of importMode — see runMission docstring
  });

  // Availability requires priceModel, which a plugin is often unable
  // to determine with confidence (free vs. pay-per-unlock vs.
  // subscription usually isn't stated on a title's own page) — so
  // skip creating it rather than guess, same "leave blank" rule as
  // everything else in this engine.
  if (result.availability?.platform && result.availability.deepLinkUrl && result.availability.priceModel) {
    await addAvailability(title.id, {
      platform: result.availability.platform,
      deepLinkUrl: result.availability.deepLinkUrl,
      priceModel: result.availability.priceModel,
      priceAmountCents: result.availability.priceAmountCents,
      regionAvailability: result.availability.regionAvailability,
    });
  }

  return { titleId: title.id };
}

/** For the admin UI's source picker — reflects whatever's actually registered, never a hardcoded list. */
export async function getRegisteredSources(): Promise<DiscoverySource[]> {
  await requireAdmin();
  return listSources();
}

/**
 * Runs one discovery mission end to end.
 *
 * NOTE on importMode: "publish" in DiscoveryRequest is intentionally
 * NOT wired to Title.isPublished yet. Every mission-created title is
 * created with isPublished: false so a human always makes the final
 * call to go live from the admin review screen (Volume 5 — Import
 * Review — not built yet). importMode is threaded through the result
 * so that screen can act on it later; treat it as inert for now.
 */
export async function runMission(request: DiscoveryRequest): Promise<DiscoveryRunResult> {
  await requireAdmin();

  const missionId = randomUUID().slice(0, 8);
  const logger = new MissionLogger(missionId);
  const startedAt = Date.now();

  logger.info("Mission started", request);

  const plugin = getPlugin(request.source);
  const items: ImportedDiscoveryItem[] = [];

  let discovered: Awaited<ReturnType<typeof plugin.discover>> = [];
  try {
    discovered = await plugin.discover(request);
    logger.info(`Discovered ${discovered.length} candidate URL(s)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery phase failed for an unknown reason.";
    logger.error("Discovery phase failed — aborting mission", err);
    // Previously this returned a plain empty-but-"successful" result,
    // indistinguishable in the UI from a run that genuinely found
    // nothing. That's the actual bug behind "surfacing nothing no
    // matter what URL I throw at it": a plugin that's intentionally
    // unimplemented for its source (DramaBox — see that plugin's
    // docstring), or that doesn't support the selected mission
    // (ReelShort/ShortMax outside manualUrls), throws a real,
    // specific, useful error message right here — and it was being
    // thrown away. Now it's returned on `error` so the admin UI can
    // actually show it instead of a silent "No items discovered."
    return {
      summary: {
        totalDiscovered: 0,
        imported: 0,
        skipped: 0,
        failed: 0,
        duplicates: 0,
        durationMs: Date.now() - startedAt,
      },
      items: [],
      error: message,
      logs: logger.getEntries().slice(),
    };
  }

  const capped = discovered.slice(0, request.quantity);

  for (const item of capped) {
    try {
      const result = await plugin.importTitle(item.titleUrl);
      const duplicate = result.title.name
        ? await checkDuplicate(result.title.name)
        : { isDuplicate: false, score: 0, reason: "No name extracted — cannot check for duplicates." };

      const shouldAttemptImport =
        !duplicate.isDuplicate || request.duplicatePolicy === "import";

      if (!shouldAttemptImport) {
        logger.info(`Skipped (duplicate policy: ${request.duplicatePolicy})`, {
          url: item.titleUrl,
          matchedTitle: duplicate.existingTitleName,
        });
        items.push({ result, duplicate, imported: false, skipped: true });
        continue;
      }

      try {
        await persistImportResult(result);
        logger.info("Imported", { url: item.titleUrl, name: result.title.name });
        items.push({ result, duplicate, imported: true, skipped: false });
      } catch (persistErr) {
        const message = persistErr instanceof Error ? persistErr.message : "Unknown persist error";
        logger.warn(`Left for manual review: ${message}`, { url: item.titleUrl });
        items.push({ result, duplicate, imported: false, skipped: false, failure: message });
      }
    } catch (importErr) {
      const message = importErr instanceof Error ? importErr.message : "Unknown import error";
      logger.error(`Import failed for ${item.titleUrl}`, importErr);
      items.push({
        result: {
          sourceUrl: item.titleUrl,
          source: item.source,
          confidence: 0,
          title: {},
          missingFields: [],
          warnings: [{ field: "*", message }],
        },
        duplicate: { isDuplicate: false, score: 0 },
        imported: false,
        skipped: false,
        failure: message,
      });
    }
  }

  const summary = {
    totalDiscovered: discovered.length,
    imported: items.filter((i) => i.imported).length,
    skipped: items.filter((i) => i.skipped).length,
    failed: items.filter((i) => !i.imported && !i.skipped && i.failure).length,
    duplicates: items.filter((i) => i.duplicate.isDuplicate).length,
    durationMs: Date.now() - startedAt,
  };

  if (discovered.length === 0 && request.mission === "manualUrls" && (request.urls?.length ?? 0) > 0) {
    // The plugin didn't throw, but every pasted URL got filtered out
    // by its own supports(url) check — e.g. a ReelShort source
    // selected with ShortMax links pasted in, or vice versa. Same
    // "silent zero" problem as the discover()-throws case above, just
    // from a different code path (each plugin's own manualUrls
    // filter, not an exception) — worth a clear log line since the
    // summary panel alone won't explain it.
    logger.warn(
      `None of the ${request.urls!.length} pasted URL(s) matched ${request.source}'s expected domain — check the Source dropdown matches where these links are actually from.`
    );
  }

  logger.info("Mission finished", summary);

  return { summary, items, logs: logger.getEntries().slice() };
}
