import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MOOD_CHIPS, DEFAULT_MOODS, findChip } from "@/lib/moodChips";
import { MoodChipBar } from "@/components/MoodChipBar";
import { SearchBar } from "@/components/SearchBar";
import { TitleRail } from "@/components/TitleRail";
import { IdentityNavLink } from "@/components/IdentityNavLink";
import { CollectionsRail } from "@/components/CollectionsRail";

export const dynamic = "force-dynamic"; // trending/rails depend on live interaction data

interface HomePageProps {
  searchParams: Promise<{ mood?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const activeValues = params.mood?.split(",").filter(Boolean) ?? [];
  const activeChips = activeValues.map(findChip).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const chipsToShow = activeChips.length ? activeChips : DEFAULT_MOODS;

  return (
    <main className="mx-auto max-w-6xl px-6 py-14 pb-20">
      <header className="mb-10">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Kilig</p>
          <div className="flex items-center gap-4">
            <Link href="/curators" className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent-marigold)]">
              Curators
            </Link>
            <Suspense fallback={null}>
              <IdentityNavLink />
            </Suspense>
          </div>
        </div>
        <h1 className="mb-7 max-w-xl break-words font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)] sm:text-4xl">
          What do you want to feel tonight?
        </h1>
        <div className="mb-7 flex flex-wrap items-center gap-3">
          <SearchBar className="mb-0" />
          <Link
            href="/titles"
            className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-[var(--text)] transition-colors hover:border-[var(--accent-marigold)]"
          >
            Browse all
          </Link>
        </div>
        <MoodChipBar />
      </header>

      <Suspense fallback={null}>
        <CollectionsRail />
      </Suspense>

      <Suspense fallback={<p className="text-[var(--text-muted)]">Loading trending...</p>}>
        <TrendingRail />
      </Suspense>

      <Suspense fallback={<p className="text-[var(--text-muted)]">Loading...</p>}>
        <FandomTrendingRail />
      </Suspense>

      <Suspense fallback={<p className="text-[var(--text-muted)]">Loading...</p>}>
        <NewestRail />
      </Suspense>

      <Suspense fallback={<p className="text-[var(--text-muted)]">Loading...</p>}>
        {chipsToShow.map((chip) => (
          <MoodRail key={chip.value} chip={chip} />
        ))}
      </Suspense>
    </main>
  );
}

async function NewestRail() {
  // Trending needs real interaction volume and is empty pre-launch;
  // the mood rails depend on which chips happen to be selected and
  // can, in principle, come up empty for an unlucky combination. This
  // rail has neither dependency — as long as at least one title is
  // published, first-open never renders a blank page below the header.
  const titles = await prisma.title.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return <TitleRail eyebrow="New on Kilig" titles={titles} />;
}

async function TrendingRail() {
  // Trending must be real or absent — see ARCHITECTURE.md. This returns
  // an empty array gracefully pre-launch (no interaction volume yet),
  // and TitleRail already hides itself when given an empty list.
  //
  // MIN_CLICKS_FOR_TRENDING mirrors the same 5-sample floor used
  // everywhere else honesty-gated in this app (matching.ts's
  // MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL, actions.ts's
  // MIN_VOTES_FOR_SKIP_METER_DISPLAY) — found missing during an audit:
  // this query previously had no floor at all, so a single click-through
  // was enough to label a title "trending," which read as real signal
  // but wasn't distinguishable from noise or the admin's own testing.
  const MIN_CLICKS_FOR_TRENDING = 5;

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const grouped = await prisma.userInteraction.groupBy({
    by: ["titleId"],
    where: { action: "clicked_out", createdAt: { gte: since } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    having: { id: { _count: { gte: MIN_CLICKS_FOR_TRENDING } } },
    take: 10,
  });

  if (grouped.length === 0) return null;

  const titles = await prisma.title.findMany({
    where: { id: { in: grouped.map((g: { titleId: string }) => g.titleId) }, isPublished: true },
  });
  // Preserve trending order (Prisma's `in` filter doesn't guarantee it).
  const ordered = grouped
    .map((g: { titleId: string }) => titles.find((t: { id: string }) => t.id === g.titleId))
    .filter((t): t is (typeof titles)[number] => t != null);

  return <TitleRail eyebrow="Trending right now" titles={ordered} />;
}

async function FandomTrendingRail() {
  // Deliberately a *separate* signal from TrendingRail above, not a
  // blend of the two — that rail measures view/click behavior
  // (clicked_out), this one measures reaction volume (reacted). They
  // answer different questions ("what are people actually watching"
  // vs. "what's getting an emotional reaction right now") and merging
  // them would quietly overwrite one honest signal with another. See
  // ARCHITECTURE.md's "Trending must be real or absent" principle —
  // same reasoning applies here: empty result renders nothing rather
  // than falling back to some other list to fill the section.
  //
  // 48h window, not 7 days like TrendingRail: reactions are a lower-
  // volume signal than clicks (one tap vs. every click-through), and
  // the whole point of "in the Fandom" is current buzz, not a title
  // that quietly accumulated reactions over a week. 48h gave enough
  // room for a slow news day without just re-showing TrendingRail's
  // week-old winners under a different label.
  // MIN_REACTIONS_FOR_TRENDING mirrors the same 5-sample floor as
  // TrendingRail above (and matching.ts/actions.ts elsewhere) — same
  // audit finding, same fix: this had no floor either.
  const MIN_REACTIONS_FOR_TRENDING = 5;

  const since = new Date();
  since.setHours(since.getHours() - 48);

  const grouped = await prisma.userInteraction.groupBy({
    by: ["titleId"],
    where: { action: "reacted", createdAt: { gte: since } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    having: { id: { _count: { gte: MIN_REACTIONS_FOR_TRENDING } } },
    take: 10,
  });

  if (grouped.length === 0) return null;

  const titles = await prisma.title.findMany({
    where: { id: { in: grouped.map((g: { titleId: string }) => g.titleId) }, isPublished: true },
  });
  const ordered = grouped
    .map((g: { titleId: string }) => titles.find((t: { id: string }) => t.id === g.titleId))
    .filter((t): t is (typeof titles)[number] => t != null);

  return <TitleRail eyebrow="Trending in the Fandom · reactions, last 48h" titles={ordered} />;
}

async function MoodRail({ chip }: { chip: (typeof MOOD_CHIPS)[number] }) {
  const where =
    chip.type === "mood"
      ? { moodTags: { has: chip.value }, isPublished: true }
      : { tropeTags: { has: chip.value }, isPublished: true };

  const titles = await prisma.title.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return <TitleRail eyebrow={`Because you want ${chip.label.toLowerCase()}`} titles={titles} />;
}
