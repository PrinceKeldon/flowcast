"use server";

import { redirect } from "next/navigation";
import {
  createTitle,
  updateTitle,
  deleteTitle,
  addAvailability,
  updateAvailability,
  deleteAvailability,
  addReaction,
  deleteReaction,
} from "@/lib/actions";
import type { Pacing, PriceModel } from "@/generated/prisma/client";
import { checkDuplicate } from "@/lib/discovery/duplicate";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | undefined {
  const value = str(formData, key);
  return value || undefined;
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Shared FormData -> TitleFields parsing, used by both create and
 * update so the two forms can't quietly drift apart on which fields
 * they read or how.
 */
function parseTitleFields(formData: FormData) {
  const pacing = optionalStr(formData, "pacing") as Pacing | undefined;
  const episodeCountRaw = optionalStr(formData, "episodeCount");
  const releaseDateRaw = optionalStr(formData, "releaseDate");
  const editorialHookPoint = optionalStr(formData, "editorialHookPoint") as
    | "hooks_fast"
    | "slow_burn"
    | "filler_heavy"
    | undefined;
  const editorialEndingType = optionalStr(formData, "editorialEndingType") as
    | "happy"
    | "bittersweet"
    | "cliffhanger"
    | "unresolved"
    | undefined;

  return {
    name: str(formData, "name"),
    synopsis: optionalStr(formData, "synopsis"),
    language: str(formData, "language"),
    countryOfOrigin: optionalStr(formData, "countryOfOrigin"),
    tropeTags: splitTags(str(formData, "tropeTags")),
    moodTags: splitTags(str(formData, "moodTags")),
    pacing,
    castType: optionalStr(formData, "castType"),
    episodeCount: episodeCountRaw ? Number(episodeCountRaw) : undefined,
    coverImageUrl: optionalStr(formData, "coverImageUrl"),
    isPublished: formData.get("isPublished") === "on",
    editorialHookPoint,
    editorialEndingType,
    seasonOfId: optionalStr(formData, "seasonOfId"),
    seasonNumber: (() => {
      const raw = optionalStr(formData, "seasonNumber");
      return raw ? Number(raw) : undefined;
    })(),
    castNames: splitTags(str(formData, "castNames")),
    releaseDate: releaseDateRaw ? new Date(releaseDateRaw) : undefined,
  };
}

export interface CreateTitleFormState {
  duplicateWarning?: { existingTitleId: string; existingTitleName: string; score: number };
  error?: string;
}

/**
 * Same duplicate/season shape as loginAdminAction in admin-actions.ts
 * (see LoginForm.tsx) — a useActionState-compatible action, because
 * "warn, but let the admin proceed anyway" genuinely needs state to
 * survive from one submission to the next on the same form, which a
 * plain FormData → void action (like every other *FromForm function
 * here) has no way to do.
 *
 * The duplicate check is skipped entirely when this title is
 * explicitly linked as a season of another (seasonOfId set) — an
 * intentional near-duplicate name like "Show Name Season 2" would
 * otherwise trip the same bigram-similarity check that's meant to
 * catch accidental re-entry, and a warning would just be noise once
 * the relationship's already been declared. It's also skipped once
 * the admin has explicitly acknowledged a prior warning for this
 * submission (acknowledgeDuplicate=true, set by the checkbox that
 * appears once a warning has already been shown once — see
 * NewTitleForm.tsx).
 *
 * checkDuplicate() itself is the same bigram-similarity check the
 * Discovery Engine's mission runner already uses (duplicate.ts) —
 * reused here rather than reimplemented, since it was previously only
 * ever wired into the now-mostly-inert automated import path and
 * never into this one, the actual primary path titles get created
 * through.
 */
export async function createTitleAction(
  _prevState: CreateTitleFormState,
  formData: FormData
): Promise<CreateTitleFormState> {
  const fields = parseTitleFields(formData);
  const acknowledged = formData.get("acknowledgeDuplicate") === "true";

  if (!fields.seasonOfId && !acknowledged) {
    const duplicate = await checkDuplicate(fields.name);
    if (duplicate.isDuplicate && duplicate.existingTitleId && duplicate.existingTitleName) {
      return {
        duplicateWarning: {
          existingTitleId: duplicate.existingTitleId,
          existingTitleName: duplicate.existingTitleName,
          score: duplicate.score,
        },
      };
    }
  }

  const title = await createTitle(fields);
  redirect(`/admin/titles/${title.id}`);
}

export async function updateTitleFromForm(id: string, formData: FormData) {
  await updateTitle(id, parseTitleFields(formData));
  redirect(`/admin/titles/${id}`);
}

export async function deleteTitleFromForm(id: string) {
  await deleteTitle(id);
  redirect("/admin");
}

export async function addAvailabilityFromForm(titleId: string, formData: FormData) {
  const priceModel = str(formData, "priceModel") as PriceModel;
  const priceAmountRaw = optionalStr(formData, "priceAmountCents");
  const regions = splitTags(str(formData, "regionAvailability"));

  await addAvailability(titleId, {
    platform: str(formData, "platform"),
    deepLinkUrl: str(formData, "deepLinkUrl"),
    priceModel,
    priceAmountCents: priceAmountRaw ? Number(priceAmountRaw) : undefined,
    regionAvailability: regions.length ? regions : undefined,
  });

  redirect(`/admin/titles/${titleId}`);
}

export async function updateAvailabilityFromForm(id: string, titleId: string, formData: FormData) {
  const priceModel = str(formData, "priceModel") as PriceModel;
  const priceAmountRaw = optionalStr(formData, "priceAmountCents");
  const regions = splitTags(str(formData, "regionAvailability"));

  await updateAvailability(id, titleId, {
    platform: str(formData, "platform"),
    deepLinkUrl: str(formData, "deepLinkUrl"),
    priceModel,
    priceAmountCents: priceAmountRaw ? Number(priceAmountRaw) : undefined,
    regionAvailability: regions.length ? regions : undefined,
  });

  redirect(`/admin/titles/${titleId}`);
}

export async function deleteAvailabilityFromForm(id: string, titleId: string) {
  await deleteAvailability(id, titleId);
  redirect(`/admin/titles/${titleId}`);
}

export async function addReactionFromForm(titleId: string, formData: FormData) {
  const displayOrderRaw = optionalStr(formData, "displayOrder");

  await addReaction(titleId, {
    emoji: str(formData, "emoji"),
    quoteText: str(formData, "quoteText"),
    authorHandle: optionalStr(formData, "authorHandle"),
    displayOrder: displayOrderRaw ? Number(displayOrderRaw) : undefined,
  });

  redirect(`/admin/titles/${titleId}`);
}

export async function deleteReactionFromForm(id: string, titleId: string) {
  await deleteReaction(id, titleId);
  redirect(`/admin/titles/${titleId}`);
}
