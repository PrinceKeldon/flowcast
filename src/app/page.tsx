import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { MOOD_CHIPS, DEFAULT_MOODS, findChip } from "@/lib/moodChips";
import { MoodChipBar } from "@/components/MoodChipBar";
import { SearchBar } from "@/components/SearchBar";
import { TitleRail } from "@/components/TitleRail";

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
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Kilig</p>
        <h1 className="mb-7 max-w-xl break-words font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)] sm:text-4xl">
          What do you want to feel tonight?
        </h1>
        <SearchBar />
        <MoodChipBar />
      </header>

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
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const grouped = await prisma.userInteraction.groupBy({
    by: ["titleId"],
    where: { action: "clicked_out", createdAt: { gte: since } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
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
  const since = new Date();
  since.setHours(since.getHours() - 48);

  const grouped = await prisma.userInteraction.groupBy({
    by: ["titleId"],
    where: { action: "reacted", createdAt: { gte: since } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
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
