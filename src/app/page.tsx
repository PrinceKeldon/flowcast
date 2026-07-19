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
        <h1 className="mb-7 max-w-xl font-[var(--font-display)] text-4xl font-semibold uppercase text-[var(--text)]">
          What do you want to feel tonight?
        </h1>
        <SearchBar />
        <MoodChipBar />
      </header>

      <Suspense fallback={<p className="text-[var(--text-muted)]">Loading trending...</p>}>
        <TrendingRail />
      </Suspense>

      <Suspense fallback={<p className="text-[var(--text-muted)]">Loading...</p>}>
        {chipsToShow.map((chip) => (
          <MoodRail key={chip.value} chip={chip} />
        ))}
      </Suspense>
    </main>
  );
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
