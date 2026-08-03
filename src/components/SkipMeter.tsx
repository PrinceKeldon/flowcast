"use client";

import { useState, useTransition } from "react";
import { logHookVote, getMyHookVote } from "@/lib/actions";
import type { HookVoteBucket } from "@/lib/actions";

const VOTE_OPTIONS: { bucket: HookVoteBucket; label: string }[] = [
  { bucket: "ep1", label: "Ep 1" },
  { bucket: "ep3", label: "Ep 3" },
  { bucket: "ep9", label: "Ep 9" },
  { bucket: "never", label: "Never" },
];

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
  /** Computed server-side via a read-only session peek — see title/[id]/page.tsx. */
  initialVotedBucket: HookVoteBucket | null;
  /**
   * Already threshold-gated server-side (see MIN_VOTES_FOR_SKIP_METER_DISPLAY
   * in actions.ts) — null here means "don't show an aggregate yet",
   * not "no votes at all". Voting still works either way.
   */
  voteSummary: { counts: Record<HookVoteBucket, number>; total: number } | null;
}

export function SkipMeter({
  titleId,
  editorialHookPoint,
  editorialEndingType,
  initialVotedBucket,
  voteSummary,
}: SkipMeterProps) {
  const [votedBucket, setVotedBucket] = useState<HookVoteBucket | null>(initialVotedBucket);
  const [pendingBucket, setPendingBucket] = useState<HookVoteBucket | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasVoted = votedBucket !== null;
  const hasEditorial = editorialHookPoint || editorialEndingType;

  function handleVote(bucket: HookVoteBucket) {
    if (hasVoted || isPending) return;

    setPendingBucket(bucket);
    startTransition(async () => {
      const result = await logHookVote(titleId, bucket);

      if (result.ok) {
        setVotedBucket(bucket);
      } else if (result.alreadyVoted) {
        // Same reasoning as ReactionTap's race-condition fallback —
        // don't assume the just-tapped bucket is the one that landed.
        const actual = await getMyHookVote(titleId);
        setVotedBucket(actual ?? bucket);
      }
      setPendingBucket(null);
    });
  }

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

      <p className="mb-2 text-sm text-[var(--text)]">When did it hook you?</p>
      <div className="flex gap-2">
        {VOTE_OPTIONS.map(({ bucket, label }) => {
          const isThisOne = votedBucket === bucket;
          const isThisPending = pendingBucket === bucket && isPending;
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => handleVote(bucket)}
              disabled={hasVoted || isPending}
              aria-pressed={isThisOne}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase transition-all ${
                isThisOne
                  ? "border-[var(--accent-marigold)] bg-[var(--accent-marigold)]/10 text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)]"
              } ${hasVoted && !isThisOne ? "opacity-40" : ""} ${
                !hasVoted && !isPending ? "hover:border-[var(--accent-marigold)]" : ""
              } ${isThisPending ? "animate-pulse" : ""}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {voteSummary ? (
        <div className="mt-4">
          {VOTE_OPTIONS.map(({ bucket, label }) => {
            const pct = Math.round((voteSummary.counts[bucket] / voteSummary.total) * 100);
            return (
              <div key={bucket} className="mb-1.5 flex items-center gap-2">
                <span className="w-10 shrink-0 font-mono text-[11px] text-[var(--text-muted)]">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg)]">
                  <div className="h-full rounded-full bg-[var(--accent-marigold)]" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-9 shrink-0 text-right font-mono text-[11px] text-[var(--text-muted)]">{pct}%</span>
              </div>
            );
          })}
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            {voteSummary.total} votes
          </p>
        </div>
      ) : (
        <p className="mt-2.5 text-xs text-[var(--text-muted)]">Results show once enough people vote.</p>
      )}
    </div>
  );
}
