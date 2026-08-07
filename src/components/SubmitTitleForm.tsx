"use client";

import { useState, useTransition, useActionState } from "react";
import Link from "next/link";
import { fetchTitleMetadataForCurator } from "@/lib/fetchTitleMetadata";
import { submitTitleFromLink, type SubmitTitleState } from "@/lib/curator-actions";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none";
const labelClass = "mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]";

const initialState: SubmitTitleState = {};

interface SubmitTitleFormProps {
  collectionId: string;
}

export function SubmitTitleForm({ collectionId }: SubmitTitleFormProps) {
  const [referenceUrl, setReferenceUrl] = useState("");
  const [name, setName] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [episodeCount, setEpisodeCount] = useState("");
  const [castNames, setCastNames] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [note, setNote] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [isFetching, startFetch] = useTransition();

  const [state, formAction, isSubmitting] = useActionState(submitTitleFromLink, initialState);

  function handleFetch() {
    setFetchError(null);
    if (!referenceUrl.trim()) {
      setFetchError("Paste a link first.");
      return;
    }
    startFetch(async () => {
      const result = await fetchTitleMetadataForCurator(referenceUrl.trim());
      const foundNothing =
        !result.name && !result.synopsis && !result.coverImageUrl && result.episodeCount === null;
      if (result.error && foundNothing) {
        setFetchError(result.error);
        return;
      }
      if (result.name) setName(result.name);
      if (result.synopsis) setSynopsis(result.synopsis);
      if (result.coverImageUrl) setCoverImageUrl(result.coverImageUrl);
      if (result.episodeCount !== null) setEpisodeCount(String(result.episodeCount));
      if (result.castNames.length > 0) setCastNames(result.castNames.join(", "));
      if (result.releaseDate) setReleaseDate(result.releaseDate.slice(0, 10));
      setHasFetched(true);
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
        Add a title not on Kilig
      </p>
      <p className="mb-4 text-xs text-[var(--text-muted)]">
        It&apos;ll appear here as pending until it&apos;s reviewed and fully live on Kilig.
      </p>

      <div className="mb-4 flex gap-2">
        <input
          type="url"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
          placeholder="Paste a link to the title"
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={isFetching}
          className="shrink-0 rounded-xl border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent-marigold)] disabled:opacity-50"
        >
          {isFetching ? "Fetching…" : "Fetch"}
        </button>
      </div>
      {fetchError && <p className="mb-4 text-sm text-[var(--accent-rose)]">{fetchError}</p>}

      {hasFetched && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="collectionId" value={collectionId} />

          <div>
            <label className={labelClass} htmlFor="submitName">Name</label>
            <input
              id="submitName"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="submitSynopsis">Synopsis</label>
            <textarea
              id="submitSynopsis"
              name="synopsis"
              rows={2}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="submitCoverImageUrl">Cover image URL</label>
              <input
                id="submitCoverImageUrl"
                name="coverImageUrl"
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className={inputClass}
              />
            </div>
            {coverImageUrl && (
              <div className="h-[64px] w-[41px] shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element -- external, unverified URL, preview only */}
                <img src={coverImageUrl} alt="Cover preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="submitEpisodeCount">Episode count</label>
              <input
                id="submitEpisodeCount"
                name="episodeCount"
                type="number"
                min={0}
                value={episodeCount}
                onChange={(e) => setEpisodeCount(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="submitReleaseDate">Release date</label>
              <input
                id="submitReleaseDate"
                name="releaseDate"
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="submitCastNames">Cast (comma-separated)</label>
            <input
              id="submitCastNames"
              name="castNames"
              value={castNames}
              onChange={(e) => setCastNames(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="submitNote">Your note (optional, 140 characters)</label>
            <input
              id="submitNote"
              name="note"
              maxLength={140}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this belongs in this Collection"
              className={inputClass}
            />
          </div>

          {state.error && (
            <div className="rounded-xl border border-[var(--accent-rose)]/50 bg-[var(--accent-rose)]/10 p-3">
              <p className="text-sm text-[var(--text)]">{state.error}</p>
              {state.duplicateOf && (
                <Link
                  href={`/title/${state.duplicateOf.id}`}
                  className="mt-1.5 inline-block text-sm text-[var(--accent-marigold)] hover:underline"
                >
                  Save &ldquo;{state.duplicateOf.name}&rdquo; to this Collection instead →
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 self-start rounded-xl bg-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Adding…" : "Add to this Collection"}
          </button>
        </form>
      )}
    </div>
  );
}
