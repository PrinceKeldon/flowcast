import Link from "next/link";
import type { Metadata } from "next";
import { getCuratorDirectory } from "@/lib/curator-actions";

export const metadata: Metadata = { title: "Curators" };

export default async function CuratorsPage() {
  const curators = await getCuratorDirectory();

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 pb-20">
      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Kilig</p>
      <h1 className="mb-2 font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)]">
        Curators
      </h1>
      <p className="mb-8 text-sm text-[var(--text-muted)]">
        People building taste-based Collections of vertical dramas. Open a profile to follow — you&rsquo;ll need a name of your own first.
      </p>

      {curators.length === 0 ? (
        <p className="text-[var(--text-muted)]">No curators yet — be the first.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {curators.map((curator) => (
            <li key={curator.id}>
              <Link
                href={`/curator/${curator.displayName}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent-marigold)]"
              >
                <p className="font-[var(--font-display)] text-lg text-[var(--text)]">{curator.displayName}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  {curator.followers.count === null ? "New curator" : `${curator.followers.count} follower${curator.followers.count === 1 ? "" : "s"}`}
                  {" · "}
                  {curator._count.collections} Collection{curator._count.collections === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
