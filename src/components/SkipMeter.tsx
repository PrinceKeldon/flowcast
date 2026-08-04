import { logHookVoteFromForm } from "@/lib/actions";

const HOOK_POINT_LABELS: Record<string, string> = {
  hooks_fast: "Hooks fast",
  slow_burn: "Slow burn, worth it",
  filler_heavy: "Filler-heavy",
};

const ENDING_TYPE_LABELS: Record<string, string> = {
  happy: "Happy ending",
  bittersweet: "Bittersweet ending",
  cliffhanger: "Cliffhanger",
  unresolved: "Unresolved",
};

interface SkipMeterProps {
  titleId: string;
  editorialHookPoint: string | null;
  editorialEndingType: string | null;
  /** Used as the number input's max — omitted (no upper bound shown) when unknown. */
  episodeCount: number | null;
  /**
   * Computed server-side in title/[id]/page.tsx via a read-only
   * session peek. null means "hasn't voted yet" (show the form); a
   * value (including hookedAtEpisode: null for "never") means this
   * session already voted (show that instead of the form — the
   * database is the only source of truth here, there's no client-side
   * state to keep in sync with it).
   */
  priorVote: { hookedAtEpisode: number | null } | null;
  /**
   * Already threshold-gated server-side (see MIN_VOTES_FOR_SKIP_METER_DISPLAY
   * in actions.ts) — null here means "don't show an aggregate yet",
   * not "no votes at all". Voting still works either way.
   */
  voteSummary: { total: number; neverCount: number; medianEpisode: number | null } | null;
}

export function SkipMeter({
  titleId,
  editorialHookPoint,
  editorialEndingType,
  episodeCount,
  priorVote,
  voteSummary,
}: SkipMeterProps) {
  const hasEditorial = editorialHookPoint || editorialEndingType;
  const submitVote = logHookVoteFromForm.bind(null, titleId);

  return (
    <div className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Skip Meter</p>

      {hasEditorial && (
        <div className="mb-4 flex flex-wrap gap-2">
          {editorialHookPoint && (
            <span className="rounded-full border border-[var(--accent-marigold)]/40 bg-[var(--accent-marigold)]/10 px-2.5 py-1 font-mono text-[11px] uppercase text-[var(--text)]">
              {HOOK_POINT_LABELS[editorialHookPoint] ?? editorialHookPoint}
            </span>
          )}
          {editorialEndingType && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 font-mono text-[11px] uppercase text-[var(--text-muted)]">
              {ENDING_TYPE_LABELS[editorialEndingType] ?? editorialEndingType}
            </span>
          )}
        </div>
      )}

      {priorVote ? (
        <p className="text-sm text-[var(--text)]">
          {priorVote.hookedAtEpisode === null ? (
            "You said this one never hooked you."
          ) : (
            <>
              You said episode <span className="font-semibold">{priorVote.hookedAtEpisode}</span> hooked you.
            </>
          )}
        </p>
      ) : (
        <form action={submitVote} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`hookedAtEpisode-${titleId}`} className="mb-1 block text-sm text-[var(--text)]">
              Which episode hooked you?
            </label>
            <input
              id={`hookedAtEpisode-${titleId}`}
              name="hookedAtEpisode"
              type="number"
              min={1}
              max={episodeCount ?? undefined}
              placeholder={episodeCount ? `1–${episodeCount}` : "Episode #"}
              className="w-28 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent-marigold)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
          >
            Submit
          </button>
          <button
            type="submit"
            name="neverHooked"
            value="on"
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--accent-rose)] hover:text-[var(--accent-rose)]"
          >
            Never got into it
          </button>
        </form>
      )}

      {voteSummary && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          {voteSummary.medianEpisode !== null && `Median hook point: Episode ${voteSummary.medianEpisode} · `}
          {Math.round((voteSummary.neverCount / voteSummary.total) * 100)}% never got into it · {voteSummary.total}{" "}
          votes
        </p>
      )}
    </div>
  );
}
