import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { peekCuratorId } from "@/lib/curator";
import { removeFromCollection, getCollectionLikeState, getCollectionItemLikeStates } from "@/lib/curator-actions";
import { TitleCoverArt } from "@/components/TitleCoverArt";
import { LikeButton } from "@/components/LikeButton";
import { SubmitTitleForm } from "@/components/SubmitTitleForm";

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
        include: {
          title: {
            select: { id: true, name: true, coverImageUrl: true, language: true, episodeCount: true, isPublished: true },
          },
        },
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

  // Draft/unpublished titles (e.g. a curator's own pending "Add a
  // title not on Kilig" submission) are visible only to the
  // Collection's owner, with a "pending review" badge instead of a
  // link into /title/[id] (which would 404/redirect for anyone but
  // an admin anyway) and no like button — nobody but the owner can
  // even see it yet, so a like count would be meaningless. Everyone
  // else simply doesn't see the item at all — same "real or absent"
  // rule as everywhere else honesty-gated in this app, not a broken
  // card with a dead link.
  const visibleItems = collection.items.filter((item) => item.title.isPublished || isOwner);
  const itemIds = visibleItems.map((item) => item.id);

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

      {visibleItems.length === 0 ? (
        <p className="mb-8 text-[var(--text-muted)]">
          Nothing saved here yet{isOwner && " — save a title from any title page to get started"}.
        </p>
      ) : (
        <ul className="mb-8 flex flex-col gap-4">
          {visibleItems.map((item) => {
            const isPending = !item.title.isPublished;
            const likeState = itemLikeStates[item.id] ?? { count: 0, liked: false };
            return (
              <li
                key={item.id}
                className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
              >
                {isPending ? (
                  <div className="block w-[72px] shrink-0">
                    <div className="aspect-[9/16] overflow-hidden rounded-xl bg-black opacity-60">
                      <TitleCoverArt title={item.title} showTitleOverlay={false} />
                    </div>
                  </div>
                ) : (
                  <Link href={`/title/${item.title.id}`} className="block w-[72px] shrink-0">
                    <div className="aspect-[9/16] overflow-hidden rounded-xl bg-black">
                      <TitleCoverArt title={item.title} showTitleOverlay={false} />
                    </div>
                  </Link>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  {isPending ? (
                    <p className="font-[var(--font-display)] text-base text-[var(--text)]">{item.title.name}</p>
                  ) : (
                    <Link
                      href={`/title/${item.title.id}`}
                      className="font-[var(--font-display)] text-base text-[var(--text)] hover:text-[var(--accent-marigold)]"
                    >
                      {item.title.name}
                    </Link>
                  )}
                  {isPending && (
                    <span className="mb-1 mt-0.5 w-fit rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                      Pending review
                    </span>
                  )}
                  <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">&ldquo;{item.note}&rdquo;</p>
                  <div className="mt-2 flex items-center gap-3">
                    {!isPending && (
                      <LikeButton
                        kind="item"
                        id={item.id}
                        collectionId={collection.id}
                        initialLiked={likeState.liked}
                        initialCount={likeState.count}
                        size="sm"
                      />
                    )}
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

      {isOwner && (
        <>
          <p className="mb-3 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Or</p>
          <SubmitTitleForm collectionId={collection.id} />
        </>
      )}
    </main>
  );
}
