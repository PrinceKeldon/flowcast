import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { peekCuratorId } from "@/lib/curator";
import { removeFromCollection } from "@/lib/curator-actions";
import { TitleCoverArt } from "@/components/TitleCoverArt";

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
  const collection = await getCollection(id);
  if (!collection) notFound();

  const curatorId = await peekCuratorId();
  const isOwner = curatorId === collection.curator.id;

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
      <Link
        href={`/curator/${collection.curator.displayName}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {collection.curator.displayName}
      </Link>

      <p className="mb-1.5 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
        Collection by {collection.curator.displayName}
      </p>
      <h1 className="mb-8 break-words font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)]">
        {collection.name}
      </h1>

      {collection.items.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          Nothing saved here yet{isOwner && " — save a title from any title page to get started"}.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {collection.items.map((item) => (
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
                {isOwner && (
                  <form action={removeFromCollection.bind(null, collection.id, item.title.id)} className="mt-2">
                    <button
                      type="submit"
                      className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent-rose)]"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
