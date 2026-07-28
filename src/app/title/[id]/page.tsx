import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSimilarTitles, computeTagAlignment } from "@/lib/matching";
import { isAdminSession } from "@/lib/admin";
import { WatchButton } from "@/components/WatchButton";
import { ReactionsList } from "@/components/ReactionsList";
import { InsightsPanel } from "@/components/InsightsPanel";
import { TaxonomySignal } from "@/components/TaxonomySignal";
import { TitleCoverArt } from "@/components/TitleCoverArt";
import { ViewLogger } from "@/components/ViewLogger";
import { TitleRail } from "@/components/TitleRail";
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
          <h1 className="mb-4 font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)]">
            {title.name}
          </h1>

          {title.synopsis && <p className="mb-7 leading-relaxed text-[var(--text)]">{title.synopsis}</p>}

          <p className="mb-3 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Watch on</p>
          <div className="mb-7">
            {title.availability.length > 0 ? (
              title.availability.map((a: Availability) => <WatchButton key={a.id} availability={a} titleId={title.id} />)
            ) : (
              <p className="text-[var(--text-muted)]">No active platform links yet.</p>
            )}
          </div>

          {/* Editorial reactions before raw taxonomy — see ARCHITECTURE.md */}
          <ReactionsList reactions={title.reactions} />

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
