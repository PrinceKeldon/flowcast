import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentCurator } from "@/lib/curator-actions";
import { CreateCollectionForm } from "@/components/CreateCollectionForm";

export const metadata = { title: "New Collection" };

export default async function NewCollectionPage() {
  const curator = await getCurrentCurator();
  if (!curator) redirect("/claim");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href={`/curator/${curator.displayName}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]">
        <ArrowLeft size={14} aria-hidden="true" />
        Back
      </Link>
      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">New Collection</p>
      <h1 className="mb-6 font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
        What does it answer?
      </h1>
      <CreateCollectionForm />
    </main>
  );
}
