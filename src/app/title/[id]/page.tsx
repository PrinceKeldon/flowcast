import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSimilarTitles } from "@/lib/matching";
import { logInteraction } from "@/lib/actions";
import { WatchButton } from "@/components/WatchButton";
import { ReactionsList } from "@/components/ReactionsList";
import { InsightsPanel } from "@/components/InsightsPanel";
import { TitleRail } from "@/components/TitleRail";
import type { Availability } from "@/generated/prisma";

interface TitleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TitleDetailPage({ params }: TitleDetailPageProps) {
  const { id } = await params;

  const title = await prisma.title.findUnique({
    where: { id },
    include: {
      availability: { where: { isActive: true } },
      reactions: { orderBy: { displayOrder: "asc" } },
    },
  });

  if (!title) notFound();

  // Fire-and-forget view logging — doesn't block the render.
  logInteraction({ titleId: title.id, action: "viewed_detail" });

  const similar = await getSimilarTitles(title.id, 6);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]">
        <ArrowLeft size={14} aria-hidden="true" />
        Back
      </Link>

      <div className="grid grid-cols-1 gap-9 sm:grid-cols-[220px_1fr]">
        <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-black">
          {title.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={title.coverImageUrl} alt={title.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--surface)] to-black font-[var(--font-display)] text-6xl text-[var(--text-muted)]">
              {title.name.slice(0, 1)}
            </div>
          )}
        </div>

        <div>
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
