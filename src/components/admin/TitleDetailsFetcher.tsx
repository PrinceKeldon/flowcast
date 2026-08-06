"use client";

import { useState, useTransition } from "react";
import { fetchTitleMetadata } from "@/lib/fetchTitleMetadata";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none";
const labelClass = "mb-1.5 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]";

interface TitleDetailsFetcherProps {
  defaultName?: string;
  defaultSynopsis?: string;
  defaultCoverImageUrl?: string;
  defaultEpisodeCount?: number | string;
  defaultCastNames?: string[];
  defaultReleaseDate?: string;
}

export function TitleDetailsFetcher({
  defaultName = "",
  defaultSynopsis = "",
  defaultCoverImageUrl = "",
  defaultEpisodeCount = "",
  defaultCastNames = [],
  defaultReleaseDate = "",
}: TitleDetailsFetcherProps) {
  const [referenceUrl, setReferenceUrl] = useState("");
  const [name, setName] = useState(defaultName);
  const [synopsis, setSynopsis] = useState(defaultSynopsis);
  const [coverImageUrl, setCoverImageUrl] = useState(defaultCoverImageUrl);
  const [episodeCount, setEpisodeCount] = useState<number | string>(defaultEpisodeCount);
  const [episodeCountSource, setEpisodeCountSource] = useState<"structured" | "text-pattern" | null>(null);
  const [castNamesText, setCastNamesText] = useState(defaultCastNames.join(", "));
  const [castNamesFetched, setCastNamesFetched] = useState(false);
  const [releaseDate, setReleaseDate] = useState(defaultReleaseDate);
  const [releaseDateFetched, setReleaseDateFetched] = useState(false);
  const [platformGuess, setPlatformGuess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFetch() {
    setError(null);
    setPlatformGuess(null);
    if (!referenceUrl.trim()) {
      setError("Paste a link first.");
      return;
    }
    startTransition(async () => {
      const result = await fetchTitleMetadata(referenceUrl.trim());
      const foundNothing =
        !result.name &&
        !result.synopsis &&
        !result.coverImageUrl &&
        result.episodeCount === null &&
        result.castNames.length === 0 &&
        !result.releaseDate;
      if (result.error && foundNothing) {
        setError(result.error);
        return;
      }
      if (result.name) setName(result.name);
      if (result.synopsis) setSynopsis(result.synopsis);
      if (result.coverImageUrl) setCoverImageUrl(result.coverImageUrl);
      if (result.platformGuess) setPlatformGuess(result.platformGuess);
      if (result.episodeCount !== null) {
        setEpisodeCount(result.episodeCount);
        setEpisodeCountSource(result.episodeCountSource);
      }
      if (result.castNames.length > 0) {
        setCastNamesText(result.castNames.join(", "));
        setCastNamesFetched(true);
      }
      if (result.releaseDate) {
        // JSON-LD datePublished is usually ISO already; slice to the
        // date-only portion an <input type="date"> expects, tolerating
        // whatever's there rather than rejecting it outright.
        setReleaseDate(result.releaseDate.slice(0, 10));
        setReleaseDateFetched(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className={labelClass} htmlFor="referenceUrl">
          Fetch details from a link (optional)
        </label>
        <div className="flex gap-2">
          <input
            id="referenceUrl"
            type="url"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleFetch}
            disabled={isPending}
            className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent-marigold)] disabled:opacity-50"
          >
            {isPending ? "Fetching…" : "Fetch details"}
          </button>
        </div>
        {error && <p className="mt-1.5 text-sm text-[var(--accent-rose)]">{error}</p>}
        {platformGuess && (
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Detected platform: <span className="text-[var(--text)]">{platformGuess}</span> — remember to add it as
            availability after saving.
          </p>
        )}
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">
          Pulls whatever the page&apos;s own preview metadata offers — works well on some platforms, not at all on
          others. Everything below stays editable either way.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="name">Name *</label>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="synopsis">Synopsis</label>
        <textarea
          id="synopsis"
          name="synopsis"
          rows={3}
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="coverImageUrl">Cover image URL</label>
        <div className="flex items-start gap-3">
          <input
            id="coverImageUrl"
            name="coverImageUrl"
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="Fetched automatically, or paste one directly"
            className={inputClass}
          />
          {coverImageUrl && (
            <div className="h-[72px] w-[46px] shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element -- external, unverified URL, preview only */}
              <img src={coverImageUrl} alt="Cover preview" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="episodeCount">Episode count</label>
        <input
          id="episodeCount"
          name="episodeCount"
          type="number"
          min={0}
          value={episodeCount}
          onChange={(e) => {
            setEpisodeCount(e.target.value);
            setEpisodeCountSource(null); // manually edited — no longer attributable to the fetch
          }}
          className={inputClass}
        />
        {episodeCountSource === "structured" && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">From the page&apos;s own structured data — reliable.</p>
        )}
        {episodeCountSource === "text-pattern" && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Guessed from page text (no structured data found) — worth double-checking.
          </p>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="releaseDate">Release date</label>
        <input
          id="releaseDate"
          name="releaseDate"
          type="date"
          value={releaseDate}
          onChange={(e) => {
            setReleaseDate(e.target.value);
            setReleaseDateFetched(false);
          }}
          className={inputClass}
        />
        {releaseDateFetched && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">From the page&apos;s own structured data — reliable.</p>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="castNames">Cast (comma-separated)</label>
        <input
          id="castNames"
          name="castNames"
          value={castNamesText}
          onChange={(e) => {
            setCastNamesText(e.target.value);
            setCastNamesFetched(false);
          }}
          placeholder="Fetched automatically when available, or type names directly"
          className={inputClass}
        />
        {castNamesFetched && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            From the page&apos;s own structured data — reliable. Not every platform includes this; blank just means
            none was found, not that there&apos;s no cast.
          </p>
        )}
      </div>
    </div>
  );
}
