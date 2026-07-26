import Link from "next/link";
import type { Title } from "@/generated/prisma/client";

interface TitleCardProps {
  title: Pick<Title, "id" | "name" | "language" | "moodTags" | "coverImageUrl" | "episodeCount" | "pacing">;
  // Match score only ever appears with a stated reference — never a bare
  // unexplained percentage, since that would imply personalization the
  // product doesn't have data for yet. See lib/matching.ts.
  matchScore?: number;
}

// Original gradient + type treatment for titles without licensed cover
// art yet (see ARCHITECTURE.md — real art should come from platform
// partners via Availability, not be generated or scraped). Picked
// deterministically per title id so the same title always gets the
// same treatment, and neighboring cards in a rail read as visually
// distinct rather than one repeated gray placeholder.
const FALLBACK_GRADIENTS = [
  "bg-gradient-to-br from-[#12131A] via-[#3a2a1f] to-[#E8A33D]",
  "bg-gradient-to-br from-[#12131A] via-[#3a1a24] to-[#D65F7A]",
  "bg-gradient-to-br from-[#12131A] via-[#2a1c30] to-[#D65F7A]",
  "bg-gradient-to-br from-[#12131A] via-[#332417] to-[#E8A33D]",
];

function pickGradient(id: string): string {
  const sum = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return FALLBACK_GRADIENTS[sum % FALLBACK_GRADIENTS.length];
}

export function TitleCard({ title, matchScore }: TitleCardProps) {
  return (
    <Link
      href={`/title/${title.id}`}
      className="block w-[132px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 pb-2.5 transition-transform hover:-translate-y-1"
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
        {title.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized source URLs from producers
          <img src={title.coverImageUrl} alt={title.name} className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full items-start p-2.5 ${pickGradient(title.id)}`}>
            <p className="font-[var(--font-display)] text-base font-bold uppercase leading-[1.05] text-[#F1EEE6]">
              {title.name}
            </p>
          </div>
        )}
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
      <p className="mt-2 font-[var(--font-display)] text-sm leading-tight text-[var(--text)]">{title.name}</p>
      <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
        {title.language.toUpperCase()} · {title.episodeCount ?? "?"} eps · {title.pacing ?? "—"}
      </p>
    </Link>
  );
}
