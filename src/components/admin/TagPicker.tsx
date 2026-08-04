"use client";

import { useState } from "react";

export interface TagOption {
  value: string;
  label: string;
}

interface TagPickerProps {
  /** The form field name this submits under — e.g. "moodTags", matching parseTitleFields exactly. */
  name: string;
  label: string;
  availableTags: TagOption[];
  /** Raw values (already normalized, e.g. "guilty_pleasure") — for pre-filling the edit form. */
  defaultValues?: string[];
  /** Trope chips read marigold, mood chips read rose — same dual-accent convention as MoodChipBar.tsx. */
  accent: "trope" | "mood";
}

/**
 * Chips for anything already registered in TagDefinition, plus a
 * plain text field underneath for anything not yet represented —
 * exactly the two things this was asked to support, not a full
 * tag-management UI. The chips and the text field both write into the
 * same hidden input, in the same comma-separated format the old plain
 * text field always submitted, so parseTitleFields() / splitTags() /
 * normalizeAndRegisterTags() in actions.ts and adminForms.ts needed
 * no changes at all — as far as the backend is concerned, this is
 * still just a comma-separated string field.
 */
export function TagPicker({ name, label, availableTags, defaultValues = [], accent }: TagPickerProps) {
  const knownValues = new Set(availableTags.map((t) => t.value));
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultValues.filter((v) => knownValues.has(v)))
  );
  // Values in defaultValues that aren't in the known chip list yet
  // (e.g. a tag someone typed by hand before this existed, or one
  // that's since been deactivated) still need to round-trip correctly
  // on an edit — they land in the free-text field rather than
  // silently disappearing.
  const [extraText, setExtraText] = useState(defaultValues.filter((v) => !knownValues.has(v)).join(", "));

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const extraValues = extraText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const combined = [...selected, ...extraValues].join(", ");

  const activeClass =
    accent === "trope"
      ? "bg-[var(--accent-marigold)] border-[var(--accent-marigold)] text-[var(--bg)]"
      : "bg-[var(--accent-rose)] border-[var(--accent-rose)] text-[var(--bg)]";

  return (
    <div>
      <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </label>

      {availableTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const isActive = selected.has(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggle(tag.value)}
                aria-pressed={isActive}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? activeClass : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-current"
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      )}

      <input
        type="text"
        value={extraText}
        onChange={(e) => setExtraText(e.target.value)}
        placeholder="Add more, comma-separated"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none"
      />
      <input type="hidden" name={name} value={combined} />
    </div>
  );
}
