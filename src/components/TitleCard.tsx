import Link from "next/link";
import type { Title } from "@/generated/prisma/client";
import { TitleCoverArt } from "@/components/TitleCoverArt";
import { CoverGlow } from "@/components/CoverGlow";

interface TitleCardProps {
  title: Pick<Title, "id" | "name" | "language" | "moodTags" | "coverImageUrl" | "episodeCount" | "pacing">;
  // Match score only ever appears with a stated reference — never a bare
  // unexplained percentage, since that would imply personalization the
  // product doesn't have data for yet. See lib/matching.ts.
  matchScore?: number;
}

export function TitleCard({ title, matchScore }: TitleCardProps) {
  return (
    <Link
      href={`/title/${title.id}`}
      className="relative block w-[180px] shrink-0 snap-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 pb-2.5 transition-transform hover:-translate-y-1 sm:w-[210px] lg:w-[230px]"
    >
      {/* Client-only dominant-hue wash + glow behind the art; no-ops
          when the cover is missing or fails to sample. */}
      <CoverGlow coverUrl={title.coverImageUrl} className="pointer-events-none absolute inset-0 rounded-2xl" />
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
        <TitleCoverArt title={title} titleTextClassName="text-lg lg:text-xl" showTitleOverlay={false} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />

        {typeof matchScore === "number" && (
          <div className="absolute right-1.5 top-1.5 rounded-full bg-[var(--accent-marigold)]/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--bg)]">
            {matchScore}% match
          </div>
        )}

        <div className="absolute inset-x-1.5 bottom-1.5 flex flex-wrap gap-1">
          {title.moodTags.slice(0, 2).map((tag: string) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border)] bg-[var(--bg)]/80 px-2 py-0.5 font-mono text-[9px] uppercase text-[var(--text)]"
            >
              {tag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
      <p className="relative mt-2 font-[var(--font-display)] text-sm leading-tight text-[var(--text)] lg:text-base">
        {title.name}
      </p>
      <p className="relative mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
        {title.language.toUpperCase()} · {title.episodeCount ?? "?"} eps · {title.pacing ?? "—"}
      </p>
    </Link>
  );
}
