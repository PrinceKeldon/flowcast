import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Kilig</p>
      <h1 className="mb-4 font-[var(--font-display)] text-3xl font-semibold uppercase text-[var(--text)]">
        Not here
      </h1>
      <p className="mb-7 leading-relaxed text-[var(--text-muted)]">
        This page doesn&apos;t exist — or the title you&apos;re looking for isn&apos;t published yet.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-[var(--accent-marigold)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
      >
        Back to Kilig
      </Link>
    </main>
  );
}
