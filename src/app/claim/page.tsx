import { redirect } from "next/navigation";
import { getCurrentCurator } from "@/lib/curator-actions";
import { ClaimIdentityForm } from "@/components/ClaimIdentityForm";

export const metadata = { title: "Claim your name" };

export default async function ClaimPage() {
  const curator = await getCurrentCurator();
  if (curator) redirect(`/curator/${curator.displayName}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Kilig</p>
      <h1 className="mb-2 font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
        Claim your name
      </h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        This is what other people will see and follow — the identity you publish Collections under.
      </p>
      <ClaimIdentityForm />
    </main>
  );
}
