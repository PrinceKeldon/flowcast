"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { claimDisplayName, type ClaimDisplayNameState } from "@/lib/curator-actions";

const initialState: ClaimDisplayNameState = {};

export function ClaimIdentityForm() {
  const [state, formAction, isPending] = useActionState(claimDisplayName, initialState);
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="displayName" className="mb-1.5 block text-sm text-[var(--text)]">
          Pick a name
        </label>
        <input
          id="displayName"
          name="displayName"
          placeholder="sarah_watches"
          autoFocus
          autoComplete="off"
          maxLength={24}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none"
        />
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          Letters, numbers, underscores · 3–24 characters
        </p>
      </div>
      {state.error && <p className="text-sm text-[var(--accent-rose)]">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-[var(--accent-marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Claiming…" : "Claim this name"}
      </button>
      <p className="text-center text-[11px] text-[var(--text-muted)]">
        No password, no email — just a name you publish Collections under.
      </p>
    </form>
  );
}
