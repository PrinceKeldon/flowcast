import type { TitleReaction } from "@/generated/prisma/client";

export function ReactionsList({ reactions }: { reactions: TitleReaction[] }) {
  if (reactions.length === 0) return null;

  return (
    <section className="mb-5">
      <p className="mb-3 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Why people love it</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {reactions.map((r) => (
          <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <span className="text-lg" aria-hidden="true">
              {r.emoji}
            </span>
            <p className="mt-2 text-sm leading-snug text-[var(--text)]">{r.quoteText}</p>
            {r.authorHandle && <p className="mt-1.5 font-mono text-[11px] text-[var(--text-muted)]">{r.authorHandle}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
