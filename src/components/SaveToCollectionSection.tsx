import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCurator, getMyCollections } from "@/lib/curator-actions";
import { AddToCollectionWidget } from "@/components/AddToCollectionWidget";

interface SaveToCollectionSectionProps {
  titleId: string;
}

// Three states, matching the MVP's minimal-identity scope (see
// ARCHITECTURE.md's Collections section): no claimed name yet, a
// claimed name but no Collections yet, or ready to save. Each state
// is one short prompt rather than an inline form for the earlier
// steps — claiming a name and creating a Collection are both rare,
// one-time actions, so sending them to a dedicated page is a better
// fit than cramming three flows into one card on the title page.
export async function SaveToCollectionSection({ titleId }: SaveToCollectionSectionProps) {
  const curator = await getCurrentCurator();

  if (!curator) {
    return (
      <div className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Save to Collection</p>
        <p className="mb-3 text-sm text-[var(--text-muted)]">Claim a name to start curating your own Collections.</p>
        <Link
          href="/claim"
          className="inline-block rounded-xl border border-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--accent-marigold)] transition-colors hover:bg-[var(--accent-marigold)]/10"
        >
          Claim a name
        </Link>
      </div>
    );
  }

  const collections = await getMyCollections();

  if (collections.length === 0) {
    return (
      <div className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Save to Collection</p>
        <p className="mb-3 text-sm text-[var(--text-muted)]">Create your first Collection to start saving titles.</p>
        <Link
          href="/collection/new"
          className="inline-block rounded-xl border border-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--accent-marigold)] transition-colors hover:bg-[var(--accent-marigold)]/10"
        >
          Create a Collection
        </Link>
      </div>
    );
  }

  const existingSaves = await prisma.collectionItem.findMany({
    where: { titleId, collection: { curatorId: curator.id } },
    select: { collectionId: true, note: true },
  });
  const existingNotesByCollectionId = Object.fromEntries(existingSaves.map((s) => [s.collectionId, s.note]));

  return (
    <AddToCollectionWidget titleId={titleId} collections={collections} existingNotesByCollectionId={existingNotesByCollectionId} />
  );
}
