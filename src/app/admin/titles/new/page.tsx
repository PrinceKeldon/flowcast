import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { NewTitleForm } from "@/components/admin/NewTitleForm";

export default async function NewTitlePage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  // For the season picker — name + id only, every existing title.
  // Fine at this catalogue's scale as a plain <select>; revisit with
  // real search if the list ever gets too long to scan.
  const titles = await prisma.title.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const tagDefinitions = await prisma.tagDefinition.findMany({
    where: { category: { in: ["trope", "mood"] }, isActive: true },
    select: { category: true, value: true, label: true },
    orderBy: { label: "asc" },
  });
  const tropeTagOptions = tagDefinitions
    .filter((t: { category: string }) => t.category === "trope")
    .map((t: { value: string; label: string }) => ({ value: t.value, label: t.label }));
  const moodTagOptions = tagDefinitions
    .filter((t: { category: string }) => t.category === "mood")
    .map((t: { value: string; label: string }) => ({ value: t.value, label: t.label }));

  return (
    <main className="mx-auto max-w-xl px-6 py-14 pb-20">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to admin
      </Link>

      <h1 className="mb-7 font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
        New title
      </h1>

      <NewTitleForm titles={titles} tropeTagOptions={tropeTagOptions} moodTagOptions={moodTagOptions} />
    </main>
  );
}
