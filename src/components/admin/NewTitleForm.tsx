"use client";

import { useActionState } from "react";
import { createTitleAction, type CreateTitleFormState } from "@/lib/adminForms";
import { TitleDetailsFetcher } from "@/components/admin/TitleDetailsFetcher";
import { TagPicker, type TagOption } from "@/components/admin/TagPicker";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none";
const labelClass = "mb-1.5 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]";

const initialState: CreateTitleFormState = {};

interface NewTitleFormProps {
  /** For the season picker — every existing title, so "this is Season 2 of X" can point at Season 1. */
  titles: { id: string; name: string }[];
  tropeTagOptions: TagOption[];
  moodTagOptions: TagOption[];
}

export function NewTitleForm({ titles, tropeTagOptions, moodTagOptions }: NewTitleFormProps) {
  const [state, formAction, isPending] = useActionState(createTitleAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <TitleDetailsFetcher />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="language">Viewing language (ISO code) *</label>
          <input
            id="language"
            name="language"
            required
            defaultValue="en"
            placeholder="en"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            What a viewer can actually watch this in on Kilig — not original production language.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="countryOfOrigin">Country of origin (optional)</label>
          <input id="countryOfOrigin" name="countryOfOrigin" className={inputClass} />
          <p className="mt-1 text-xs text-[var(--text-muted)]">Not shown publicly yet — skip if unsure.</p>
        </div>
      </div>

      <TagPicker name="tropeTags" label="Trope tags" availableTags={tropeTagOptions} accent="trope" />

      <TagPicker name="moodTags" label="Mood tags" availableTags={moodTagOptions} accent="mood" />

      <div>
        <label className={labelClass} htmlFor="castType">Cast type</label>
        <input id="castType" name="castType" placeholder="unknown_cast" className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="pacing">Pacing</label>
        <select id="pacing" name="pacing" defaultValue="" className={inputClass}>
          <option value="">—</option>
          <option value="fast">Fast</option>
          <option value="medium">Medium</option>
          <option value="slow">Slow</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="editorialHookPoint">Skip Meter — hook point</label>
          <select id="editorialHookPoint" name="editorialHookPoint" defaultValue="" className={inputClass}>
            <option value="">—</option>
            <option value="hooks_fast">Hooks fast</option>
            <option value="slow_burn">Slow burn, worth it</option>
            <option value="filler_heavy">Filler-heavy</option>
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Judgeable from the first episode or two.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="editorialEndingType">Skip Meter — ending (optional)</label>
          <select id="editorialEndingType" name="editorialEndingType" defaultValue="" className={inputClass}>
            <option value="">— haven&apos;t finished it —</option>
            <option value="happy">Happy</option>
            <option value="bittersweet">Bittersweet</option>
            <option value="cliffhanger">Cliffhanger</option>
            <option value="unresolved">Unresolved</option>
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Only fill in once you&apos;ve actually finished it.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="seasonOfId">This is a season of (optional)</label>
          <select id="seasonOfId" name="seasonOfId" defaultValue="" className={inputClass}>
            <option value="">— standalone title —</option>
            {titles.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Season 2+ almost always has its own watch link — this links it back to Season 1, not merges them.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="seasonNumber">Season number</label>
          <input id="seasonNumber" name="seasonNumber" type="number" min={1} placeholder="2" className={inputClass} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input type="checkbox" name="isPublished" className="accent-[var(--accent-marigold)]" />
        Publish immediately
      </label>

      {state.duplicateWarning && (
        <div className="rounded-xl border border-[var(--accent-rose)]/50 bg-[var(--accent-rose)]/10 p-4">
          <p className="text-sm text-[var(--text)]">
            This looks similar to an existing title —{" "}
            <span className="font-semibold">{state.duplicateWarning.existingTitleName}</span> (
            {Math.round(state.duplicateWarning.score * 100)}% name match). If this is a genuinely new title (or a
            season that should use the picker above instead), you can still create it.
          </p>
          <label className="mt-2.5 flex items-center gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" name="acknowledgeDuplicate" value="true" className="accent-[var(--accent-marigold)]" />
            I know — create it anyway
          </label>
        </div>
      )}
      {state.error && <p className="text-sm text-[var(--accent-rose)]">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-xl bg-[var(--accent-marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Checking…" : "Create title"}
      </button>
    </form>
  );
}
