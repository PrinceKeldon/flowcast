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
  };
}

/**
 * Each of these is a thin FormData → typed-args adapter around the
 * actual mutation in actions.ts (which is where requireAdmin() and the
 * Prisma call live). Keeping the admin-check and the Prisma write in
 * one place means these forms can't accidentally bypass it.
 */
export async function createTitleFromForm(formData: FormData) {
  const title = await createTitle(parseTitleFields(formData));
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
