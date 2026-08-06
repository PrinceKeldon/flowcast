import Link from "next/link";
import { getRecentCollections } from "@/lib/curator-actions";
import { TitleCoverArt } from "@/components/TitleCoverArt";

/**
 * Deliberately shows the curator's name and the Collection's name
 * right on the card, unclaimed visitors included — that's the whole
 * point (see the "Continue" conversation this was added from). What's
 * gated is opening the card, not seeing it exists.
 */
export async function CollectionsRail() {
  const collections = await getRecentCollections(8);
  if (collections.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[var(--font-display)] text-lg uppercase tracking-wide text-[var(--text)]">Collections</h2>
        <Link href="/curators" className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent-marigold)]">
          All curators
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {collections.map((collection) => {
          const coverTitle = collection.items[0]?.title;
          return (
            <Link
              key={collection.id}
              href={`/collection/${collection.id}`}
              className="w-44 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--accent-marigold)]"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-black">
                {coverTitle && (
                  <TitleCoverArt title={coverTitle} showTitleOverlay={false} />
                )}
              </div>
              <div className="p-3">
                <p className="truncate font-[var(--font-display)] text-sm text-[var(--text)]">{collection.name}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  {collection.curator.displayName} · {collection._count.items} title{collection._count.items === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
