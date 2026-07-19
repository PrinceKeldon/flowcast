import { redirect } from "next/navigation";
import { isAdminSession, logoutAdminAction } from "@/lib/admin";

export default async function AdminPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  return (
    <main className="mx-auto max-w-lg px-6 py-14">
      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Kilig</p>
      <h1 className="mb-4 font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
        Admin
      </h1>
      <p className="mb-7 leading-relaxed text-[var(--text-muted)]">
        You&apos;re logged in. The title/availability/reaction mutations in{" "}
        <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[13px]">lib/actions.ts</code>{" "}
        (<code className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[13px]">createTitle</code>,{" "}
        <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[13px]">addAvailability</code>,{" "}
        <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[13px]">addReaction</code>) now
        require this session. There&apos;s no data-entry form here yet — call them from{" "}
        <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[13px]">db:seed</code> or a
        future admin form.
      </p>
      <form action={logoutAdminAction}>
        <button
          type="submit"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-[var(--text)] transition-colors hover:border-[var(--accent-rose)]"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
