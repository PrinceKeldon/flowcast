import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { peekCuratorId } from "@/lib/curator";
import { getFollowerDisplay, isFollowing } from "@/lib/curator-actions";
import { FollowButton } from "@/components/FollowButton";

interface CuratorPageProps {
  params: Promise<{ displayName: string }>;
}

async function getCuratorByName(displayName: string) {
  return prisma.curator.findFirst({
    where: { displayName: { equals: displayName, mode: "insensitive" } },
    include: {
      collections: {
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { items: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: CuratorPageProps): Promise<Metadata> {
  const { displayName } = await params;
  const curator = await getCuratorByName(displayName);
  if (!curator) return {};
  return { title: curator.displayName, description: `Collections curated by ${curator.displayName} on Kilig.` };
}

export default async function CuratorPage({ params }: CuratorPageProps) {
  const { displayName } = await params;
  const curator = await getCuratorByName(displayName);
  if (!curator) notFound();

  const viewerCuratorId = await peekCuratorId();
  const isOwnProfile = viewerCuratorId === curator.id;

  const [followerDisplay, viewerIsFollowing] = await Promise.all([
    getFollowerDisplay(curator.id, isOwnProfile),
    isOwnProfile ? Promise.resolve(false) : isFollowing(curator.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Curator</p>
          <h1 className="mb-2 break-words font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)]">
            {curator.displayName}
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            {followerDisplay.count === null ? "New curator" : `${followerDisplay.count} follower${followerDisplay.count === 1 ? "" : "s"}`}
            {" · "}
            {curator.collections.length} Collection{curator.collections.length === 1 ? "" : "s"}
          </p>
        </div>

        {isOwnProfile ? (
          <Link
            href="/collection/new"
            className="shrink-0 rounded-xl bg-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
          >
            New Collection
          </Link>
        ) : viewerCuratorId ? (
          <FollowButton curatorId={curator.id} initialIsFollowing={viewerIsFollowing} />
        ) : (
          <Link
            href="/claim"
            className="shrink-0 rounded-xl border border-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--accent-marigold)] transition-colors hover:bg-[var(--accent-marigold)]/10"
          >
            Claim a name to follow
          </Link>
        )}
      </div>

      {curator.collections.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          {isOwnProfile ? "No Collections yet — create your first one." : "No Collections yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {curator.collections.map((collection) => (
            <li key={collection.id}>
              <Link
                href={`/collection/${collection.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent-marigold)]"
              >
                <p className="font-[var(--font-display)] text-lg text-[var(--text)]">{collection.name}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  {collection._count.items} title{collection._count.items === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
