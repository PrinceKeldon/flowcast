"use client";

import { useActionState } from "react";
import { createCollection, type CreateCollectionState } from "@/lib/curator-actions";

const initialState: CreateCollectionState = {};

export function CreateCollectionForm() {
  const [state, formAction, isPending] = useActionState(createCollection, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm text-[var(--text)]">
          Collection name
        </label>
        <input
          id="name"
          name="name"
          placeholder="CEOs Worth Falling For"
          autoFocus
          maxLength={80}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none"
        />
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          Every Collection answers one question — what does this one answer?
        </p>
      </div>
      {state.error && <p className="text-sm text-[var(--accent-rose)]">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-[var(--accent-marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create Collection"}
      </button>
    </form>
  );
}
