import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { findChip } from "@/lib/moodChips";
import { MoodChipBar } from "@/components/MoodChipBar";
import { TitleCard } from "@/components/TitleCard";

export const dynamic = "force-dynamic"; // new titles should appear without a rebuild

interface BrowseAllPageProps {
  searchParams: Promise<{ mood?: string }>;
}

export default async function BrowseAllPage({ searchParams }: BrowseAllPageProps) {
  const params = await searchParams;
  const activeValues = params.mood?.split(",").filter(Boolean) ?? [];
  const activeChips = activeValues
    .map(findChip)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const where: Prisma.TitleWhereInput = { isPublished: true };
  if (activeChips.length) {
    // Multiple chips OR together ("show me longing OR heartbreak"),
    // mirroring how each MoodRail on the home page matches a chip by
    // mood or trope depending on its type.
    where.OR = activeChips.map((chip) =>
      chip.type === "mood"
        ? { moodTags: { has: chip.value } }
        : { tropeTags: { has: chip.value } },
    );
  }

  const titles = await prisma.title.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-14 pb-20">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back
      </Link>

      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
        Kilig
      </p>
      <h1 className="mb-7 max-w-xl break-words font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)] sm:text-4xl">
        Browse all titles
      </h1>

      <MoodChipBar basePath="/titles" />

      {titles.length === 0 && (
        <p className="text-[var(--text-muted)]">
          {activeChips.length
            ? "No titles match those moods yet. Try removing a chip, or check back soon."
            : "No titles yet — check back soon."}
        </p>
      )}

      {titles.length > 0 && (
        <>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            {titles.length} title{titles.length === 1 ? "" : "s"}
            {activeChips.length
              ? ` matching ${activeChips.map((c) => c.label.toLowerCase()).join(" or ")}`
              : ""}{" "}
            · A–Z
          </p>
          <div className="flex flex-wrap gap-4">
            {titles.map((title) => (
              <TitleCard key={title.id} title={title} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
