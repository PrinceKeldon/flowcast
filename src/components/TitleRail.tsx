import type { Title } from "@/generated/prisma";
import { TitleCard } from "@/components/TitleCard";

interface TitleRailProps {
  eyebrow: string;
  titles: Array<
    Pick<Title, "id" | "name" | "language" | "moodTags" | "coverImageUrl" | "episodeCount" | "pacing"> & {
      matchScore?: number;
    }
  >;
}

export function TitleRail({ eyebrow, titles }: TitleRailProps) {
  if (titles.length === 0) return null;

  return (
    <section className="mb-9">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{eyebrow}</p>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {titles.map((title) => (
          <TitleCard key={title.id} title={title} matchScore={title.matchScore} />
        ))}
      </div>
    </section>
  );
}
