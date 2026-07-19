import { Search } from "lucide-react";

/**
 * Deliberately a Server Component. A plain <form method="GET"> needs no
 * client JS to work — the browser handles the navigation to /search?q=...
 * itself. Keeps this consistent with the "few Client Components"
 * philosophy in ARCHITECTURE.md (MoodChipBar is the only place that
 * actually needs client-side interactivity).
 */
export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" method="GET" className="mb-7 flex max-w-md items-center gap-2">
      <div className="flex flex-1 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 focus-within:border-[var(--accent-marigold)]">
        <Search size={16} className="text-[var(--text-muted)]" aria-hidden="true" />
        <input
          type="text"
          name="q"
          defaultValue={defaultValue}
          placeholder="Search titles..."
          className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-[var(--text)] transition-colors hover:border-[var(--accent-marigold)]"
      >
        Search
      </button>
    </form>
  );
}
