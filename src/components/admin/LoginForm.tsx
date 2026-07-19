"use client";

import { useActionState } from "react";
import { loginAdminAction, type LoginFormState } from "@/lib/admin";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAdminAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="password"
        name="password"
        placeholder="Admin password"
        autoFocus
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none"
      />
      {state.error && <p className="text-sm text-[var(--accent-rose)]">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-[var(--accent-marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
