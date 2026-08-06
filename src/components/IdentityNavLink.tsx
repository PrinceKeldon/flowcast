import Link from "next/link";
import { getCurrentCurator } from "@/lib/curator-actions";

/**
 * Tiny, unobtrusive entry point into the Collections feature from the
 * homepage header — "Claim a name" for a first-time visitor, or a
 * link straight to their own profile once they've claimed one. Kept
 * to a single text link rather than a full nav bar, since the rest of
 * the app deliberately has none (see layout.tsx) and this feature
 * isn't meant to become the primary navigation.
 */
export async function IdentityNavLink() {
  const curator = await getCurrentCurator();

  if (curator) {
    return (
      <Link
        href={`/curator/${curator.displayName}`}
        className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        {curator.displayName}&rsquo;s Collections
      </Link>
    );
  }

  return (
    <Link
      href="/claim"
      className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
    >
      Claim a name → start curating
    </Link>
  );
}
