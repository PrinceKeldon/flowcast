"use server";

import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";
import { requireAdmin } from "@/lib/admin";
import type { InteractionAction, Prisma } from "@/generated/prisma/client";
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
  const title = await prisma.title.create({ data });
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
