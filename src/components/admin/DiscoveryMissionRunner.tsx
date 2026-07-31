"use client";

import { useState, useTransition } from "react";
import { runMission } from "@/lib/discovery/mission";
import type {
  DiscoveryMission,
  DiscoveryRunResult,
  DiscoverySource,
  DuplicatePolicy,
  ImportedDiscoveryItem,
  ImportMode,
} from "@/lib/discovery/types";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent-marigold)] focus:outline-none";
const labelClass = "mb-1.5 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]";

const MISSIONS: DiscoveryMission[] = ["topCharts", "latest", "genre", "mood", "search"];
const DUPLICATE_POLICIES: DuplicatePolicy[] = ["review", "skip", "import"];
const IMPORT_MODES: ImportMode[] = ["draft", "publish"];

interface DiscoveryMissionRunnerProps {
  sources: DiscoverySource[];
}

export function DiscoveryMissionRunner({ sources }: DiscoveryMissionRunnerProps) {
  const [source, setSource] = useState<DiscoverySource | "">(sources[0] ?? "");
  const [mission, setMission] = useState<DiscoveryMission>("topCharts");
  const [quantity, setQuantity] = useState(10);
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("review");
  const [importMode, setImportMode] = useState<ImportMode>("draft");

  const [result, setResult] = useState<DiscoveryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    setError(null);
    setResult(null);
    if (!source) {
      setError("Pick a source first.");
      return;
    }
    startTransition(async () => {
      try {
        const runResult = await runMission({
          source,
          mission,
          quantity,
          duplicatePolicy,
          importMode,
        });
        setResult(runResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Mission failed for an unknown reason.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="source">Source</label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value as DiscoverySource)}
            className={inputClass}
          >
            {sources.length === 0 && <option value="">No sources registered</option>}
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="mission">Mission</label>
          <select
            id="mission"
            value={mission}
            onChange={(e) => setMission(e.target.value as DiscoveryMission)}
            className={inputClass}
          >
            {MISSIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Not every plugin supports every mission yet — an unsupported combination fails clearly rather than
            guessing.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="duplicatePolicy">Duplicate policy</label>
          <select
            id="duplicatePolicy"
            value={duplicatePolicy}
            onChange={(e) => setDuplicatePolicy(e.target.value as DuplicatePolicy)}
            className={inputClass}
          >
            {DUPLICATE_POLICIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="importMode">Import mode</label>
          <select
            id="importMode"
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as ImportMode)}
            className={inputClass}
          >
            {IMPORT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Inert for now — every imported title lands unpublished either way, until the review screen exists.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={isPending || sources.length === 0}
        className="self-start rounded-xl bg-[var(--accent-marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Running mission…" : "Run mission"}
      </button>

      {error && (
        <p className="rounded-xl border border-[var(--accent-rose)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--accent-rose)]">
          {error}
        </p>
      )}

      {result && <MissionResultView result={result} />}
    </div>
  );
}

function MissionResultView({ result }: { result: DiscoveryRunResult }) {
  const { summary, items } = result;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-5 gap-2">
        <SummaryStat label="Discovered" value={summary.totalDiscovered} />
        <SummaryStat label="Imported" value={summary.imported} accent="marigold" />
        <SummaryStat label="Duplicates" value={summary.duplicates} />
        <SummaryStat label="Skipped" value={summary.skipped} />
        <SummaryStat label="Failed" value={summary.failed} accent="rose" />
      </div>
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {(summary.durationMs / 1000).toFixed(1)}s
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No items discovered.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <MissionItemRow key={i} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: number; accent?: "marigold" | "rose" }) {
  const color = accent === "marigold" ? "text-[var(--accent-marigold)]" : accent === "rose" ? "text-[var(--accent-rose)]" : "text-[var(--text)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-center">
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function MissionItemRow({ item }: { item: ImportedDiscoveryItem }) {
  const { result, duplicate, imported, skipped, failure } = item;
  const status = imported ? "imported" : skipped ? "skipped" : failure ? "failed" : "review";
  const statusColor =
    status === "imported"
      ? "text-[var(--accent-marigold)]"
      : status === "failed"
        ? "text-[var(--accent-rose)]"
        : "text-[var(--text-muted)]";

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--text)]">{result.title.name ?? "(no name extracted)"}</p>
          <a
            href={result.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
          >
            {result.sourceUrl}
          </a>
        </div>
        <span className={`shrink-0 font-mono text-[10px] uppercase tracking-wide ${statusColor}`}>{status}</span>
      </div>

      {duplicate.isDuplicate && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">
          Similar to existing title <span className="text-[var(--text)]">{duplicate.existingTitleName}</span> (
          {(duplicate.score * 100).toFixed(0)}%)
        </p>
      )}
      {failure && <p className="mt-1.5 text-xs text-[var(--accent-rose)]">{failure}</p>}
      {result.missingFields.length > 0 && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">
          Missing: {result.missingFields.join(", ")}
        </p>
      )}
    </li>
  );
}
