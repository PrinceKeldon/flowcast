import Link from "next/link";
import type { Title } from "@/generated/prisma";

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
      className="block w-[132px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 pb-2.5 transition-transform hover:-translate-y-1"
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
        {title.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized source URLs from producers
          <img src={title.coverImageUrl} alt={title.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--surface)] to-black font-[var(--font-display)] text-4xl text-[var(--text-muted)]">
            {title.name.slice(0, 1)}
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
