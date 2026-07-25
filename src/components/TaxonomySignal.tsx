import type { TagAlignment } from "@/lib/matching";

interface TaxonomySignalProps {
  tropeAlignment: TagAlignment[];
  moodAlignment: TagAlignment[];
  basedOnCount: number;
}

export function TaxonomySignal({ tropeAlignment, moodAlignment, basedOnCount }: TaxonomySignalProps) {
  if (basedOnCount === 0 || (tropeAlignment.length === 0 && moodAlignment.length === 0)) return null;

  return (
    <details className="mt-4 border-t border-[var(--border)] pt-4">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent-marigold)]">
        Taxonomy signal
      </summary>
      <div className="mt-3.5">
        <p className="mb-3.5 text-xs text-[var(--text-muted)]">
          Share of the {basedOnCount} similar titles below that also carry each tag.
        </p>
        {tropeAlignment.length > 0 && (
          <AlignmentGroup label="Trope alignment" items={tropeAlignment} colorVar="--accent-marigold" />
        )}
        {moodAlignment.length > 0 && (
          <AlignmentGroup label="Mood alignment" items={moodAlignment} colorVar="--accent-rose" />
        )}
      </div>
    </details>
  );
}

function AlignmentGroup({
  label,
  items,
  colorVar,
}: {
  label: string;
  items: TagAlignment[];
  colorVar: string;
}) {
  return (
    <div className="mb-3.5 last:mb-0">
      <p className="mb-2 font-mono text-[11px] text-[var(--text-muted)]">{label}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.value} className="flex items-center gap-2.5">
            <span className="w-28 shrink-0 truncate text-xs text-[var(--text)]">{item.label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(item.fraction * 100)}%`, backgroundColor: `var(${colorVar})` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-[10px] text-[var(--text-muted)]">
              {item.fraction.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
