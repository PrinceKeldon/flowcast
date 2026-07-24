import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { isAdminSession, logoutAdminAction } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const titles = await prisma.title.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, isPublished: true, language: true },
  });

  return (
    <main className="mx-auto max-w-lg px-6 py-14 pb-20">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Kilig</p>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
            Admin
          </h1>
        </div>
        <form action={logoutAdminAction}>
          <button
            type="submit"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs uppercase tracking-wide text-[var(--text)] transition-colors hover:border-[var(--accent-rose)]"
          >
            Log out
          </button>
        </form>
      </div>

      <Link
        href="/admin/titles/new"
        className="mb-7 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
      >
        <Plus size={16} aria-hidden="true" />
        New title
      </Link>

      <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        Titles ({titles.length})
      </p>

      {titles.length === 0 ? (
        <p className="text-[var(--text-muted)]">No titles yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {titles.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/titles/${t.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent-marigold)]"
              >
                <span>{t.name}</span>
                <span className="font-mono text-[11px] uppercase text-[var(--text-muted)]">
                  {t.language} · {t.isPublished ? "published" : "draft"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
