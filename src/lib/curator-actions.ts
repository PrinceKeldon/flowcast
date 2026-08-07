"use server";

import { prisma } from "@/lib/prisma";
import { peekCuratorId, setCuratorCookie } from "@/lib/curator";
import { checkDuplicate } from "@/lib/discovery/duplicate";
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

/**
 * Only ever redirect to a same-origin relative path after claiming a
 * name. `next` comes from a query param round-tripped through a
 * hidden form field (see ClaimIdentityForm.tsx) — treat it the same
 * as any other user-supplied string. A bare "/" prefix with no
 * leading "//" (protocol-relative) or "http"/backslash trick is the
 * whole check; anything else falls back to the curator's own profile.
 */
function safeNextPath(next: string | null, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
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

  let curatorId: string;
  try {
    const curator = await prisma.curator.create({ data: { displayName } });
    curatorId = curator.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "That name is already taken." };
    }
    console.error("Failed to claim display name", err);
    return { error: "Something went wrong — try again." };
  }

  // redirect() throws internally (that's how it interrupts render) —
  // it has to happen outside the try/catch above, or it'd get caught
  // and reported as "Something went wrong."
  await setCuratorCookie(curatorId);
  redirect(safeNextPath(str(formData, "next"), `/curator/${displayName}`));
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

/**
 * "Add a title not on Kilig" — the curator-facing counterpart to
 * createTitleAction() in adminForms.ts, deliberately simpler and
 * stricter in different ways:
 *
 * - Simpler: only the fields fetchTitleMetadataForCurator() can
 *   actually surface (name, synopsis, cover, episode count, cast,
 *   release date) plus this curator's own note. No trope/mood tags,
 *   no Skip Meter fields, no publish toggle, no season linking —
 *   those stay editorial, decided at admin review time, same as
 *   every field a curator isn't positioned to judge.
 * - Stricter on duplicates: admin's version warns but allows an
 *   override; this one blocks outright on a likely match and points
 *   at the existing title instead, since a curator doesn't have the
 *   context to knowingly override the way admin might (e.g. not
 *   knowing about season-linking) — see ARCHITECTURE.md.
 *
 * Always creates isPublished: false and stamps submittedByCuratorId,
 * then immediately adds the new draft into the curator's chosen
 * Collection — this is *why* the title shows up in their collection
 * right away even before admin reviews it (with a "pending review"
 * badge — see CollectionPage's isPublished-aware rendering) rather
 * than only appearing once published.
 */
export interface SubmitTitleState {
  error?: string;
  duplicateOf?: { id: string; name: string };
}

export async function submitTitleFromLink(
  _prevState: SubmitTitleState,
  formData: FormData
): Promise<SubmitTitleState> {
  const curatorId = await peekCuratorId();
  if (!curatorId) return { error: "Claim a name before adding a title." };

  const collectionId = str(formData, "collectionId");
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { curatorId: true },
  });
  if (!collection || collection.curatorId !== curatorId) {
    return { error: "That's not one of your Collections." };
  }

  const name = str(formData, "name");
  if (!name) {
    return { error: "Couldn't get a title name from that link — try fetching again, or a different page." };
  }

  const duplicate = await checkDuplicate(name);
  if (duplicate.isDuplicate && duplicate.existingTitleId && duplicate.existingTitleName) {
    return {
      error: "This looks like it's already on Kilig.",
      duplicateOf: { id: duplicate.existingTitleId, name: duplicate.existingTitleName },
    };
  }

  const synopsis = str(formData, "synopsis");
  const coverImageUrl = str(formData, "coverImageUrl");
  const episodeCountRaw = str(formData, "episodeCount");
  const castNamesRaw = str(formData, "castNames");
  const releaseDateRaw = str(formData, "releaseDate");
  const note = str(formData, "note").slice(0, NOTE_MAX_LENGTH);

  const title = await prisma.title.create({
    data: {
      name,
      synopsis: synopsis || undefined,
      // Same default reasoning as the admin form — see
      // ARCHITECTURE.md's "viewing language, not production language"
      // reframing. Not a field a curator should have to think about
      // either.
      language: "en",
      tropeTags: [],
      moodTags: [],
      castNames: castNamesRaw
        ? castNamesRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      episodeCount: episodeCountRaw ? Number(episodeCountRaw) : undefined,
      releaseDate: releaseDateRaw ? new Date(releaseDateRaw) : undefined,
      coverImageUrl: coverImageUrl || undefined,
      isPublished: false,
      submittedByCuratorId: curatorId,
    },
  });

  await prisma.collectionItem.create({
    data: {
      collectionId,
      titleId: title.id,
      note: note || "Added by me — pending review before it's fully live on Kilig.",
    },
  });

  revalidatePath(`/collection/${collectionId}`);
  redirect(`/collection/${collectionId}`);
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

// ---------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------
//
// Unlike follower counts, like counts are always shown as their real
// number, never threshold-gated. The thing MIN_FOLLOWERS_FOR_PUBLIC_DISPLAY
// protects against is a stat stamped on a *person's* public identity
// reading as "nobody's here" — a like count on a piece of curation is
// a normal, unremarkable content stat (same category as a track's
// play count or a post's like count on any other platform), not an
// identity signal, so it doesn't have the same cost at zero.

async function requireLikeCuratorId(): Promise<string | null> {
  return peekCuratorId();
}

export async function likeCollection(collectionId: string): Promise<void> {
  const curatorId = await requireLikeCuratorId();
  if (!curatorId) return;

  try {
    await prisma.collectionLike.create({ data: { curatorId, collectionId } });
  } catch (err) {
    // P2002 = already liked, not a real error — same idempotent-tap
    // handling as followCurator().
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      console.error("Failed to like collection", err);
    }
  }
  revalidatePath(`/collection/${collectionId}`);
}

export async function unlikeCollection(collectionId: string): Promise<void> {
  const curatorId = await requireLikeCuratorId();
  if (!curatorId) return;

  await prisma.collectionLike.deleteMany({ where: { curatorId, collectionId } });
  revalidatePath(`/collection/${collectionId}`);
}

export async function likeCollectionItem(collectionItemId: string, collectionId: string): Promise<void> {
  const curatorId = await requireLikeCuratorId();
  if (!curatorId) return;

  try {
    await prisma.collectionItemLike.create({ data: { curatorId, collectionItemId } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      console.error("Failed to like collection item", err);
    }
  }
  revalidatePath(`/collection/${collectionId}`);
}

export async function unlikeCollectionItem(collectionItemId: string, collectionId: string): Promise<void> {
  const curatorId = await requireLikeCuratorId();
  if (!curatorId) return;

  await prisma.collectionItemLike.deleteMany({ where: { curatorId, collectionItemId } });
  revalidatePath(`/collection/${collectionId}`);
}

/** Server-side render state for a Collection's like button — real count plus whether the viewer (if any) already liked it. */
export async function getCollectionLikeState(collectionId: string): Promise<{ count: number; liked: boolean }> {
  const curatorId = await peekCuratorId();
  const [count, liked] = await Promise.all([
    prisma.collectionLike.count({ where: { collectionId } }),
    curatorId
      ? prisma.collectionLike.findUnique({ where: { curatorId_collectionId: { curatorId, collectionId } } }).then((r) => r !== null)
      : Promise.resolve(false),
  ]);
  return { count, liked };
}

/** Same as getCollectionLikeState() but batched for every item in a Collection at once, to avoid N+1 queries when rendering the item list. */
export async function getCollectionItemLikeStates(
  collectionItemIds: string[]
): Promise<Record<string, { count: number; liked: boolean }>> {
  if (collectionItemIds.length === 0) return {};
  const curatorId = await peekCuratorId();

  const [counts, likedRows] = await Promise.all([
    prisma.collectionItemLike.groupBy({
      by: ["collectionItemId"],
      where: { collectionItemId: { in: collectionItemIds } },
      _count: { _all: true },
    }),
    curatorId
      ? prisma.collectionItemLike.findMany({
          where: { curatorId, collectionItemId: { in: collectionItemIds } },
          select: { collectionItemId: true },
        })
      : Promise.resolve([]),
  ]);

  const countById = new Map(counts.map((c) => [c.collectionItemId, c._count._all]));
  const likedIds = new Set(likedRows.map((r) => r.collectionItemId));

  return Object.fromEntries(
    collectionItemIds.map((id) => [id, { count: countById.get(id) ?? 0, liked: likedIds.has(id) }])
  );
}

// ---------------------------------------------------------------------
// Discovery — making curators and Collections prominent
// ---------------------------------------------------------------------
//
// Deliberately a step short of a full trending/leaderboard surface
// (ARCHITECTURE.md's "not built in this pass" list still holds for
// ranking-by-popularity): these are plain, unranked "recent" and
// "alphabetical" listings, not a competitive social-proof surface.
// The gate is what does the identity-driving work here, not ranking.

/** Recently-updated Collections for the homepage rail — the primary "make curation visible" surface. */
/**
 * Only the most recently-updated items count, and only published
 * ones — a pending "Add a title not on Kilig" submission (see
 * submitTitleFromLink()) must never be the cover art a totally
 * anonymous homepage visitor sees. A Collection whose only items are
 * still pending review just shows no cover art, same graceful
 * degradation as everywhere else that filters rather than leaks.
 */
export async function getRecentCollections(limit = 8) {
  return prisma.collection.findMany({
    where: { items: { some: { title: { isPublished: true } } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      curator: { select: { displayName: true } },
      _count: { select: { items: { where: { title: { isPublished: true } } } } },
      items: {
        where: { title: { isPublished: true } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { title: { select: { id: true, coverImageUrl: true, name: true } } },
      },
    },
  });
}

/** Every published Collection that includes a given title, with its curator — surfaced directly on the title detail page. */
export async function getCollectionsFeaturingTitle(titleId: string) {
  const items = await prisma.collectionItem.findMany({
    where: { titleId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      note: true,
      collection: { select: { id: true, name: true, curator: { select: { displayName: true } } } },
    },
  });
  return items.map((i) => ({ note: i.note, ...i.collection }));
}

/** All curators with at least one Collection — the /curators directory. */
export async function getCuratorDirectory() {
  const curators = await prisma.curator.findMany({
    where: { collections: { some: { items: { some: {} } } } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { collections: true } } },
  });

  return Promise.all(
    curators.map(async (c) => ({
      ...c,
      followers: await getFollowerDisplay(c.id, false),
    }))
  );
}
