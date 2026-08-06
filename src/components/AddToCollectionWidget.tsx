"use client";

import { useActionState, useState } from "react";
import { addToCollection, type AddToCollectionState } from "@/lib/curator-actions";

interface AddToCollectionWidgetProps {
  titleId: string;
  collections: { id: string; name: string }[];
  /** Which of the curator's Collections already contain this title, and what note they used — keyed by collectionId, so switching the picker restores that Collection's existing note instead of showing a blank one. */
  existingNotesByCollectionId: Record<string, string>;
}

const initialState: AddToCollectionState = {};

export function AddToCollectionWidget({ titleId, collections, existingNotesByCollectionId }: AddToCollectionWidgetProps) {
  const [selectedId, setSelectedId] = useState(collections[0]?.id ?? "");
  const [note, setNote] = useState(existingNotesByCollectionId[collections[0]?.id ?? ""] ?? "");
  const [state, formAction, isPending] = useActionState(addToCollection, initialState);

  function handleSelectChange(id: string) {
    setSelectedId(id);
    setNote(existingNotesByCollectionId[id] ?? "");
  }

  const alreadySaved = selectedId in existingNotesByCollectionId;

  return (
    <div className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Save to Collection</p>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="titleId" value={titleId} />
        <input type="hidden" name="collectionId" value={selectedId} />

        <select
          value={selectedId}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent-marigold)] focus:outline-none"
        >
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.id in existingNotesByCollectionId ? " · already saved" : ""}
            </option>
          ))}
        </select>

        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={140}
          rows={2}
          placeholder="One line on why it belongs here…"
          className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none"
        />
        <p className="-mt-1.5 text-right font-mono text-[10px] text-[var(--text-muted)]">{note.length}/140</p>

        {state.error && <p className="text-sm text-[var(--accent-rose)]">{state.error}</p>}
        {state.ok && <p className="text-sm text-[var(--text-muted)]">Saved.</p>}

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-xl bg-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : alreadySaved ? "Update note" : "Save"}
        </button>
      </form>
    </div>
  );
}
