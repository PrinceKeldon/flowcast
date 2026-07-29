"use client";

import { useState, useTransition } from "react";
import { fetchOgImage } from "@/lib/fetchOgImage";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none";
const labelClass = "mb-1.5 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]";

interface CoverImageFieldProps {
  defaultValue?: string;
}

export function CoverImageField({ defaultValue = "" }: CoverImageFieldProps) {
  const [referenceUrl, setReferenceUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFetch() {
    setError(null);
    if (!referenceUrl.trim()) {
      setError("Paste a link first.");
      return;
    }
    startTransition(async () => {
      const result = await fetchOgImage(referenceUrl.trim());
      if (result.imageUrl) {
        setCoverImageUrl(result.imageUrl);
      } else {
        setError(result.error ?? "Couldn't find an image on that page.");
      }
    });
  }

  return (
    <div>
      <label className={labelClass} htmlFor="referenceUrl">
        Fetch cover art from a link (optional)
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
          {isPending ? "Fetching…" : "Fetch image"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-[var(--accent-rose)]">{error}</p>}

      <label className={`${labelClass} mt-4`} htmlFor="coverImageUrl">
        Cover image URL
      </label>
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
  );
}
