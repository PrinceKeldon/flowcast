interface InsightsPanelProps {
  tropeTags: string[];
  moodTags: string[];
  pacing: string | null;
}

export function InsightsPanel({ tropeTags, moodTags, pacing }: InsightsPanelProps) {
  return (
    <details className="mt-7 border-t border-[var(--border)] pt-4">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent-marigold)]">
        Insights
      </summary>
      <div className="mt-3.5">
        <p className="mb-2 font-mono text-[11px] text-[var(--text-muted)]">Tropes</p>
        <TagRow tags={tropeTags} />
        <p className="mb-2 mt-3.5 font-mono text-[11px] text-[var(--text-muted)]">Moods</p>
        <TagRow tags={moodTags} />
        {pacing && (
          <>
            <p className="mb-1 mt-3.5 font-mono text-[11px] text-[var(--text-muted)]">Pacing</p>
            <p className="text-sm capitalize text-[var(--text)]">{pacing}</p>
          </>
        )}
      </div>
    </details>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] uppercase text-[var(--text-muted)]"
        >
          {tag.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}
