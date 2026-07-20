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

export async function logSearch(query: string, filters: Record<string, unknown>) {
  // titleId is required by the schema; searches aren't tied to one title,
  // so this is intentionally skipped until the schema grows a nullable
  // search-log table. Tracked here as a known gap — see ARCHITECTURE.md.
  console.log("search logged (not yet persisted):", query, filters);
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
