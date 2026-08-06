import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { peekSessionId } from "@/lib/session";
import { getSimilarTitles, computeTagAlignment } from "@/lib/matching";
import { isAdminSession } from "@/lib/admin";
import { WatchButton } from "@/components/WatchButton";
import { ReactionsList } from "@/components/ReactionsList";
import { ReactionTap } from "@/components/ReactionTap";
import { SkipMeter } from "@/components/SkipMeter";
import { getHookVoteSummary } from "@/lib/actions";
import { InsightsPanel } from "@/components/InsightsPanel";
import { TaxonomySignal } from "@/components/TaxonomySignal";
import { TitleCoverArt } from "@/components/TitleCoverArt";
import { ViewLogger } from "@/components/ViewLogger";
import { TitleRail } from "@/components/TitleRail";
import { SaveToCollectionSection } from "@/components/SaveToCollectionSection";
import { CuratedInSection } from "@/components/CuratedInSection";
import type { Availability } from "@/generated/prisma/client";

interface TitleDetailPageProps {
  params: Promise<{ id: string }>;
}

// React's cache() dedupes this within a single request — generateMetadata
// and the page component below both call it with the same id, but Prisma
// only actually runs once per request instead of twice.
const getTitle = cache((id: string) =>
  prisma.title.findUnique({
    where: { id },
    include: {
      availability: { where: { isActive: true } },
      reactions: { orderBy: { displayOrder: "asc" } },
    },
  })
);

export async function generateMetadata({ params }: TitleDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const title = await getTitle(id);

  // Same draft-privacy rule as the page body below, applied
  // separately: generateMetadata runs independently of the page
  // component, so without this a draft's name/synopsis would still
  // leak into <head> and OG tags — visible to link-preview bots
  // (Slack, iMessage, Twitter) and page-source viewers — even though
  // the page itself 404s for non-admins. Returning {} here falls back
  // to the root layout's generic metadata, matching the 404 behavior.
  if (!title || (!title.isPublished && !(await isAdminSession()))) return {};

  const description = title.synopsis ?? "Emotion-first discovery for vertical drama.";

  // Image is intentionally NOT set here — opengraph-image.tsx in this
  // same route segment is the single source of truth for og:image /
  // twitter:image, whether that's a redirect to a real coverImageUrl
  // or a generated gradient fallback. Keeping image logic in one place
  // avoids two mechanisms disagreeing about what to show.
  return {
    title: title.name,
    description,
    openGraph: { title: title.name, description, type: "website" },
    twitter: { card: "summary_large_image", title: title.name, description },
  };
}

export default async function TitleDetailPage({ params }: TitleDetailPageProps) {
  const { id } = await params;
  const title = await getTitle(id);

  if (!title) notFound();

  // Drafts are only visible to admins (e.g. previewing before publish,
  // via the "View public page" link in /admin/titles/[id]). Everyone
  // else gets a 404 — same as if the title didn't exist. Every other
  // query in this app (home rails, /search, matching.ts) already
  // filters isPublished: true; this is the one direct-by-id lookup,
  // so it needs its own check rather than inheriting one from a where
  // clause.
  const isAdmin = await isAdminSession();
  if (!title.isPublished && !isAdmin) notFound();

  const similar = await getSimilarTitles(title.id, 6);
  const tropeAlignment = computeTagAlignment(title.tropeTags, similar, "tropeTags");
  const moodAlignment = computeTagAlignment(title.moodTags, similar, "moodTags");

  // Read-only — peekSessionId() never writes a cookie, so this is safe
  // during render (see lib/session.ts docstring). A visitor with no
  // session yet obviously hasn't reacted, so this short-circuits to
  // null without a query in that case.
  const existingSessionId = await peekSessionId();
  const priorReaction = existingSessionId
    ? await prisma.userInteraction.findFirst({
        where: { sessionId: existingSessionId, titleId: title.id, action: "reacted" },
        select: { metadata: true },
      })
    : null;
  const initialReactedEmoji = (priorReaction?.metadata as { emoji?: string } | undefined)?.emoji ?? null;

  const priorHookVote = existingSessionId
    ? await prisma.userInteraction.findFirst({
        where: { sessionId: existingSessionId, titleId: title.id, action: "hook_vote" },
        select: { metadata: true },
      })
    : null;
  // metadata.hookedAtEpisode is itself nullable ("never got into it"),
  // so this can't just be `?? null` — that would collapse "voted
  // never" into "hasn't voted", losing the distinction the form and
  // getHookVoteSummary() both rely on. priorVote is only null when no
  // row was found at all.
  const priorVote = priorHookVote
    ? { hookedAtEpisode: (priorHookVote.metadata as { hookedAtEpisode: number | null }).hookedAtEpisode }
    : null;
  const hookVoteSummary = await getHookVoteSummary(title.id);

  // "Season" here means a distinct, independently-linked Title row —
  // see schema.prisma's comment on Title.seasonOfId for why. Root is
  // this title itself if it has no seasonOfId, or whatever it points
  // at otherwise — every season in a group points at the same root,
  // so this is one query rather than a recursive walk.
  const seasonRootId = title.seasonOfId ?? title.id;
  const seasons = await prisma.title.findMany({
    where: {
      isPublished: true,
      OR: [{ id: seasonRootId }, { seasonOfId: seasonRootId }],
    },
    select: { id: true, name: true, seasonNumber: true, coverImageUrl: true },
    orderBy: { seasonNumber: "asc" },
  });
  const otherSeasons = seasons.filter((s: { id: string }) => s.id !== title.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
      <ViewLogger titleId={title.id} />
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]">
        <ArrowLeft size={14} aria-hidden="true" />
        Back
      </Link>

      <div className="grid grid-cols-1 gap-9 sm:grid-cols-[220px_1fr]">
        <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-black">
          <TitleCoverArt title={title} titleTextClassName="text-3xl" showTitleOverlay={false} />
        </div>

        <div>
          {!title.isPublished && (
            <p className="mb-2 inline-block rounded-full bg-[var(--accent-rose)]/90 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--bg)]">
              Draft — only visible to you
            </p>
          )}
          <p className="mb-1.5 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {title.language.toUpperCase()} · {title.status} · {title.episodeCount ?? "?"} episodes
          </p>
          <h1 className="mb-4 break-words font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)]">
            {title.name}
          </h1>

          {otherSeasons.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Seasons:</span>
              {seasons.map((s: { id: string; name: string; seasonNumber: number | null }) => (
                <Link
                  key={s.id}
                  href={`/title/${s.id}`}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase transition-colors ${
                    s.id === title.id
                      ? "border-[var(--accent-marigold)] bg-[var(--accent-marigold)]/10 text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent-marigold)]"
                  }`}
                >
                  {s.seasonNumber ? `Season ${s.seasonNumber}` : "Season 1"}
                </Link>
              ))}
            </div>
          )}

          {title.synopsis && <p className="mb-7 leading-relaxed text-[var(--text)]">{title.synopsis}</p>}

          {title.castNames.length > 0 && (
            <p className="mb-7 text-sm text-[var(--text-muted)]">
              <span className="font-mono text-[11px] uppercase tracking-wide">Cast: </span>
              {title.castNames.join(", ")}
            </p>
          )}

          <p className="mb-3 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Watch on</p>
          <div className="mb-7">
            {title.availability.length > 0 ? (
              title.availability.map((a: Availability) => <WatchButton key={a.id} availability={a} titleId={title.id} />)
            ) : (
              <p className="text-[var(--text-muted)]">No active platform links yet.</p>
            )}
          </div>

          <SkipMeter
            titleId={title.id}
            editorialHookPoint={title.editorialHookPoint}
            editorialEndingType={title.editorialEndingType}
            episodeCount={title.episodeCount}
            priorVote={priorVote}
            voteSummary={hookVoteSummary}
          />

          {/* Editorial reactions before raw taxonomy — see ARCHITECTURE.md */}
          <ReactionsList reactions={title.reactions} />

          <ReactionTap titleId={title.id} initialReactedEmoji={initialReactedEmoji} />

          <SaveToCollectionSection titleId={title.id} />

          <CuratedInSection titleId={title.id} />

          <InsightsPanel tropeTags={title.tropeTags} moodTags={title.moodTags} pacing={title.pacing} />

          <TaxonomySignal
            tropeAlignment={tropeAlignment}
            moodAlignment={moodAlignment}
            basedOnCount={similar.length}
          />
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mt-12">
          <TitleRail
            eyebrow="More like this"
            titles={similar.map((s: { title: typeof similar[number]["title"]; matchScore: number }) => ({ ...s.title, matchScore: s.matchScore }))}
          />
        </div>
      )}
    </main>
  );
}
