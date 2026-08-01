"use client";

import { useState, useTransition } from "react";
import { getTrendSignals } from "@/lib/discovery/trendScout";
import type { TrendSignal } from "@/lib/discovery/trendScout";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent-marigold)] focus:outline-none";

export function TrendScoutPanel() {
  const [query, setQuery] = useState("");
  const [signals, setSignals] = useState<TrendSignal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleScan() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await getTrendSignals(query || undefined);
        setSignals(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed for an unknown reason.");
      }
    });
  }

  return (
    <div className="mb-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="mb-1 font-[var(--font-display)] text-lg font-semibold uppercase text-[var(--text)]">
        Trend Scout
      </h2>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Surfaces what&apos;s being talked about right now — Reddit discussion + press coverage — as a starting
        point, not a data source. Nothing here imports automatically; find the real link yourself and paste it
        below.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="vertical drama app (default)"
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleScan}
          disabled={isPending}
          className="shrink-0 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent-marigold)] disabled:opacity-50"
        >
          {isPending ? "Scanning…" : "Scan"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--accent-rose)]">{error}</p>}

      {signals && (
        <ul className="mt-4 flex flex-col gap-2">
          {signals.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">Nothing found for this query right now.</p>
          )}
          {signals.map((signal) => (
            <li key={signal.url} className="rounded-xl border border-[var(--border)] px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={signal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[var(--text)] hover:text-[var(--accent-marigold)]"
                >
                  {signal.title}
                </a>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  {signal.source}
                </span>
              </div>
              {signal.snippet && <p className="mt-1 text-xs text-[var(--text-muted)]">{signal.snippet}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
