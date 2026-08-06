"use server";

import { prisma } from "@/lib/prisma";
import { peekCuratorId, setCuratorCookie } from "@/lib/curator";
import { Prisma } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Mirrors MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL (matching.ts) and
// MIN_VOTES_FOR_SKIP_METER_DISPLAY (actions.ts) — same reasoning: a
// handful of followers isn't a real signal, it's noise wearing a
// number. Below this, a visitor sees "New curator" instead of a count
// — see getFollowerDisplay() below. The curator themselves always
// sees their real number regardless (see ARCHITECTURE.md's
// Collections section — "two audiences" — for why).
const MIN_FOLLOWERS_FOR_PUBLIC_DISPLAY = 5;

const NOTE_MAX_LENGTH = 140;
const DISPLAY_NAME_MIN_LENGTH = 3;
const DISPLAY_NAME_MAX_LENGTH = 24;
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// ---------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------

export interface ClaimDisplayNameState {
  error?: string;
}

/**
 * Claims a display name and sets the curator cookie. This is the
 * entire "identity" surface of the MVP — no password, no email, just
 * a name. Deliberately case-insensitive on the availability check (so
 * "Sarah" and "sarah" can't both be claimed and confused for each
 * other) while still storing whatever casing the person typed, since
 * that's part of how they want their name displayed. The DB's plain
 * @unique constraint is case-sensitive, so a same-casing race is
 * still possible between the check and the insert — caught below via
 * the P2002 branch, same pattern as logReaction()'s uniqueness
 * handling in actions.ts.
 *
 * Shaped as a useActionState action (prevState, formData) — same
 * pattern as loginAdminAction in admin-actions.ts — so the claim form
 * can show a validation error inline instead of losing all input on
 * failure.
 */
export async function claimDisplayName(
  _prevState: ClaimDisplayNameState,
  formData: FormData
): Promise<ClaimDisplayNameState> {
  const displayName = str(formData, "displayName");

  if (displayName.length < DISPLAY_NAME_MIN_LENGTH || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return { error: `Name must be ${DISPLAY_NAME_MIN_LENGTH}–${DISPLAY_NAME_MAX_LENGTH} characters.` };
  }
  if (!DISPLAY_NAME_PATTERN.test(displayName)) {
    return { error: "Letters, numbers, and underscores only." };
  }

  const existing = await prisma.curator.findFirst({
    where: { displayName: { equals: displayName, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return { error: "That name is already taken." };
  }

  try {
    const curator = await prisma.curator.create({ data: { displayName } });
    await setCuratorCookie(curator.id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "That name is already taken." };
    }
    console.error("Failed to claim display name", err);
    return { error: "Something went wrong — try again." };
  }

  redirect(`/curator/${displayName}`);
}

/**
 * Read-only lookup of the currently claimed curator, if any — for
 * Server Component render bodies deciding what to show (e.g. "New
 * Collection" vs "Claim your name" on a title's detail page). Safe to
 * call during render since peekCuratorId() never writes a cookie
 * (mirrors peekSessionId() in session.ts).
 */
export async function getCurrentCurator() {
  const curatorId = await peekCuratorId();
  if (!curatorId) return null;
  return prisma.curator.findUnique({ where: { id: curatorId } });
}

// ---------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------

export interface CreateCollectionState {
  error?: string;
}

export async function createCollection(
  _prevState: CreateCollectionState,
  formData: FormData
): Promise<CreateCollectionState> {
  const curatorId = await peekCuratorId();
  if (!curatorId) return { error: "Claim a name before creating a Collection." };

  const curator = await prisma.curator.findUnique({ where: { id: curatorId } });
  if (!curator) return { error: "Claim a name before creating a Collection." };

  const name = str(formData, "name");
  if (!name) return { error: "Give the Collection a name." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };

  const collection = await prisma.collection.create({
    data: { curatorId, name },
  });

  redirect(`/collection/${collection.id}`);
}

/**
 * Adds a title to one of the current curator's own Collections with a
 * one-line note — the entire "add" loop described in the doc: save,
 * one line, done. Re-adding a title already in the Collection just
 * updates the note (see the unique index on
 * [collectionId, titleId]) rather than erroring or duplicating —
 * editing your own note is a legitimate thing to want to do, and
 * there's no separate "edit" UI for it yet.
 */
export interface AddToCollectionState {
  error?: string;
  ok?: boolean;
}

export async function addToCollection(
  _prevState: AddToCollectionState,
  formData: FormData
): Promise<AddToCollectionState> {
  const curatorId = await peekCuratorId();
  if (!curatorId) return { error: "Claim a name before saving to a Collection." };

  const collectionId = str(formData, "collectionId");
  const titleId = str(formData, "titleId");
  const note = str(formData, "note").slice(0, NOTE_MAX_LENGTH);

  if (!collectionId || !titleId) return { error: "Missing collection or title." };

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { curatorId: true },
  });
  if (!collection || collection.curatorId !== curatorId) {
    return { error: "That's not one of your Collections." };
  }

  await prisma.collectionItem.upsert({
    where: { collectionId_titleId: { collectionId, titleId } },
    create: { collectionId, titleId, note },
    update: { note },
  });

  revalidatePath(`/collection/${collectionId}`);
  revalidatePath(`/title/${titleId}`);
  return { ok: true };
}

export async function removeFromCollection(collectionId: string, titleId: string): Promise<void> {
  const curatorId = await peekCuratorId();
  if (!curatorId) return;

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { curatorId: true },
  });
  if (!collection || collection.curatorId !== curatorId) return;

  await prisma.collectionItem.deleteMany({ where: { collectionId, titleId } });
  revalidatePath(`/collection/${collectionId}`);
  revalidatePath(`/title/${titleId}`);
}

/** The current curator's own Collections — used to populate the "Save to Collection" picker. */
export async function getMyCollections() {
  const curatorId = await peekCuratorId();
  if (!curatorId) return [];
  return prisma.collection.findMany({
    where: { curatorId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });
}

// ---------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------

/**
 * Follows another curator. Enforced one-follow-per-pair by the real
 * database unique constraint (see the comment on Follow in
 * schema.prisma), not by this function checking first — same
 * reasoning as logReaction() in actions.ts: a check-then-insert would
 * be a race between two tabs/taps, not an actual guarantee. P2002 is
 * the expected shape of "already following," everything else is a
 * genuine unexpected failure.
 */
export async function followCurator(
  targetCuratorId: string
): Promise<{ ok: true } | { ok: false; alreadyFollowing: boolean }> {
  const curatorId = await peekCuratorId();
  if (!curatorId || curatorId === targetCuratorId) {
    return { ok: false, alreadyFollowing: false };
  }

  try {
    await prisma.follow.create({
      data: { followerId: curatorId, followingId: targetCuratorId },
    });
    revalidatePath(`/curator`);
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, alreadyFollowing: true };
    }
    console.error("Failed to follow curator", err);
    return { ok: false, alreadyFollowing: false };
  }
}

export async function unfollowCurator(targetCuratorId: string): Promise<void> {
  const curatorId = await peekCuratorId();
  if (!curatorId) return;

  await prisma.follow.deleteMany({
    where: { followerId: curatorId, followingId: targetCuratorId },
  });
  revalidatePath(`/curator`);
}

/**
 * Whether the current session's curator already follows the given
 * curator — used to render the follow button's initial state
 * server-side, same "check the database, not client state" approach
 * as the ReactionTap/SkipMeter prior-vote lookups in title/[id]/page.tsx.
 */
export async function isFollowing(targetCuratorId: string): Promise<boolean> {
  const curatorId = await peekCuratorId();
  if (!curatorId) return false;

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: curatorId, followingId: targetCuratorId } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * The two-audiences split described in ARCHITECTURE.md: the curator
 * viewing their own profile always sees their real number (truth
 * matters, they're building something), a visitor sees it only once
 * it clears MIN_FOLLOWERS_FOR_PUBLIC_DISPLAY — below that, `count` is
 * null and the profile page renders "New curator" instead of a
 * number close to zero. The follow relationship itself is always
 * recorded either way (see followCurator()); this only gates what
 * gets rendered to a stranger.
 */
export async function getFollowerDisplay(
  targetCuratorId: string,
  isOwnProfile: boolean
): Promise<{ count: number | null; real: number }> {
  const real = await prisma.follow.count({ where: { followingId: targetCuratorId } });
  if (isOwnProfile || real >= MIN_FOLLOWERS_FOR_PUBLIC_DISPLAY) {
    return { count: real, real };
  }
  return { count: null, real };
}
