"use server";

import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";
import { requireAdmin } from "@/lib/admin";
import type { InteractionAction, Prisma, TagCategory } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Fire-and-forget interaction logging — the seed of the recommendation
 * flywheel (see ARCHITECTURE.md). Never throws into the caller; losing
 * a click log shouldn't break the browsing experience.
 */
export async function logInteraction(input: {
  titleId: string;
  availabilityId?: string;
  action: InteractionAction;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    const sessionId = await getSessionId();
    await prisma.userInteraction.create({
      data: {
        sessionId,
        titleId: input.titleId,
        availabilityId: input.availabilityId,
        action: input.action,
        metadata: input.metadata ?? {},
      },
    });
  } catch (err) {
    console.error("Failed to log interaction", err);
    // Intentionally swallowed — see docstring.
  }
}

/**
 * Records an outbound click and returns the deep link so the client
 * component can open it. Keeping the open-in-new-tab call on the client
 * (see WatchButton.tsx) since window.open must run in the browser.
 */
export async function logWatchClick(titleId: string, availabilityId: string, platform: string) {
  await logInteraction({
    titleId,
    availabilityId,
    action: "clicked_out",
    metadata: { platform },
  });
}

/**
 * Persists a free-text search query. Separate table from
 * UserInteraction (see schema.prisma docstring on SearchLog) since a
 * search isn't tied to one titleId. Fire-and-forget, same as
 * logInteraction — a lost search log shouldn't break the results page.
 */
export async function logSearch(query: string, filters: Prisma.InputJsonValue = {}, resultCount?: number) {
  try {
    const sessionId = await getSessionId();
    await prisma.searchLog.create({
      data: { sessionId, query, filters, resultCount },
    });
  } catch (err) {
    console.error("Failed to log search", err);
    // Intentionally swallowed — see docstring.
  }
}

// ------------------------------------------------------------
// Admin mutations — gated by requireAdmin() (see lib/admin.ts). Each
// throws "Not authorized" if there's no valid admin session cookie.
// Still just a single shared password, on purpose — see ARCHITECTURE.md.
// ------------------------------------------------------------

function normalizeTagValue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function labelFromValue(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Auto-creates any TagDefinition rows that don't exist yet for the
 * given category/values, so the taxonomy grows to match what's
 * actually being tagged rather than silently accepting values that
 * never show up in TagDefinition — previously the "controlled
 * vocabulary" ARCHITECTURE.md describes wasn't enforced anywhere.
 * Existing definitions (and their label/description/isActive) are
 * left untouched — this only fills in what's missing.
 */
async function ensureTagDefinitions(category: TagCategory, values: string[]): Promise<void> {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return;

  await Promise.all(
    unique.map((value) =>
      prisma.tagDefinition.upsert({
        where: { category_value: { category, value } },
        update: {},
        create: { category, value, label: labelFromValue(value) },
      })
    )
  );
}

export async function createTitle(data: {
  name: string;
  synopsis?: string;
  language: string;
  countryOfOrigin?: string;
  tropeTags: string[];
  moodTags: string[];
  pacing?: "fast" | "medium" | "slow";
  castType?: string;
  episodeCount?: number;
  coverImageUrl?: string;
  isPublished?: boolean;
}) {
  await requireAdmin();

  const tropeTags = data.tropeTags.map(normalizeTagValue).filter(Boolean);
  const moodTags = data.moodTags.map(normalizeTagValue).filter(Boolean);
  const castType = data.castType ? normalizeTagValue(data.castType) : undefined;

  await Promise.all([
    ensureTagDefinitions("trope", tropeTags),
    ensureTagDefinitions("mood", moodTags),
    castType ? ensureTagDefinitions("cast_type", [castType]) : Promise.resolve(),
  ]);

  const title = await prisma.title.create({
    data: { ...data, tropeTags, moodTags, castType },
  });
  revalidatePath("/");
  return title;
}

export async function addAvailability(
  titleId: string,
  data: {
    platform: string;
    deepLinkUrl: string;
    priceModel: "free" | "pay_per_unlock" | "subscription" | "ad_supported";
    priceAmountCents?: number;
    regionAvailability?: string[];
  }
  ) {
  await requireAdmin();
  const availability = await prisma.availability.create({
    data: { titleId, ...data },
  });
  revalidatePath(`/title/${titleId}`);
  return availability;
}

export async function addReaction(
  titleId: string,
  data: { emoji: string; quoteText: string; authorHandle?: string; displayOrder?: number }
  ) {
  await requireAdmin();
  const reaction = await prisma.titleReaction.create({
    data: { titleId, ...data },
  });
  revalidatePath(`/title/${titleId}`);
  return reaction;
}
