import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { peekCuratorId } from "@/lib/curator";
import { removeFromCollection, getCollectionLikeState, getCollectionItemLikeStates } from "@/lib/curator-actions";
import { TitleCoverArt } from "@/components/TitleCoverArt";
import { LikeButton } from "@/components/LikeButton";

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

async function getCollection(id: string) {
  return prisma.collection.findUnique({
    where: { id },
    include: {
      curator: { select: { id: true, displayName: true } },
      items: {
        orderBy: { createdAt: "desc" },
        include: { title: { select: { id: true, name: true, coverImageUrl: true, language: true, episodeCount: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) return {};
  return {
    title: collection.name,
    description: `A Collection curated by ${collection.curator.displayName} on Kilig.`,
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { id } = await params;

  // Gated behind a claimed identity — a visitor can see this
  // Collection exists and who curated it (the homepage rail and title
  // pages show that much without claiming anything), but opening it
  // is the moment that asks for a name. See ARCHITECTURE.md's
  // Collections section for the reasoning.
  const viewerCuratorId = await peekCuratorId();
  if (!viewerCuratorId) redirect(`/claim?next=${encodeURIComponent(`/collection/${id}`)}`);

  const collection = await getCollection(id);
  if (!collection) notFound();

  const isOwner = viewerCuratorId === collection.curator.id;
  const itemIds = collection.items.map((item) => item.id);

  const [collectionLikeState, itemLikeStates] = await Promise.all([
    getCollectionLikeState(collection.id),
    getCollectionItemLikeStates(itemIds),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
      <Link
        href={`/curator/${collection.curator.displayName}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {collection.curator.displayName}
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
            Collection by {collection.curator.displayName}
          </p>
          <h1 className="break-words font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)]">
            {collection.name}
          </h1>
        </div>
        <div className="pt-1">
          <LikeButton kind="collection" id={collection.id} initialLiked={collectionLikeState.liked} initialCount={collectionLikeState.count} />
        </div>
      </div>

      {collection.items.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          Nothing saved here yet{isOwner && " — save a title from any title page to get started"}.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {collection.items.map((item) => {
            const likeState = itemLikeStates[item.id] ?? { count: 0, liked: false };
            return (
              <li
                key={item.id}
                className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
              >
                <Link href={`/title/${item.title.id}`} className="block w-[72px] shrink-0">
                  <div className="aspect-[9/16] overflow-hidden rounded-xl bg-black">
                    <TitleCoverArt title={item.title} showTitleOverlay={false} />
                  </div>
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <Link href={`/title/${item.title.id}`} className="font-[var(--font-display)] text-base text-[var(--text)] hover:text-[var(--accent-marigold)]">
                    {item.title.name}
                  </Link>
                  <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">&ldquo;{item.note}&rdquo;</p>
                  <div className="mt-2 flex items-center gap-3">
                    <LikeButton
                      kind="item"
                      id={item.id}
                      collectionId={collection.id}
                      initialLiked={likeState.liked}
                      initialCount={likeState.count}
                      size="sm"
                    />
                    {isOwner && (
                      <form action={removeFromCollection.bind(null, collection.id, item.title.id)}>
                        <button
                          type="submit"
                          className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent-rose)]"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
