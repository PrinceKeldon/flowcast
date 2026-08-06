import Link from "next/link";
import { getCollectionsFeaturingTitle } from "@/lib/curator-actions";

interface CuratedInSectionProps {
  titleId: string;
}

/**
 * The highest-visibility place a curator's name can appear — right on
 * a title page someone's already looking at, which is exactly the
 * "no, wait, this is where the actual fandom-building payoff lives"
 * placement the plain homepage rail alone doesn't give you. Curator
 * name and note are visible with no claimed identity required (same
 * split as CollectionsRail); the link itself is what's gated.
 */
export async function CuratedInSection({ titleId }: CuratedInSectionProps) {
  const collections = await getCollectionsFeaturingTitle(titleId);
  if (collections.length === 0) return null;

  return (
    <div className="mb-7">
      <p className="mb-3 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Curated in</p>
      <ul className="flex flex-col gap-2">
        {collections.map((c) => (
          <li key={c.id}>
            <Link
              href={`/collection/${c.id}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--accent-marigold)]"
            >
              <p className="text-sm text-[var(--text)]">
                <span className="font-semibold">{c.curator.displayName}</span>
                <span className="text-[var(--text-muted)]"> — {c.name}</span>
              </p>
              <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">&ldquo;{c.note}&rdquo;</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
