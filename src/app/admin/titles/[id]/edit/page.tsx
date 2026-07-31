import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { updateTitleFromForm } from "@/lib/adminForms";
import { TitleDetailsFetcher } from "@/components/admin/TitleDetailsFetcher";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none";
const labelClass = "mb-1.5 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]";

interface EditTitlePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTitlePage({ params }: EditTitlePageProps) {
  if (!(await isAdminSession())) redirect("/admin/login");

  const { id } = await params;
  const title = await prisma.title.findUnique({ where: { id } });
  if (!title) notFound();

  const updateThisTitle = updateTitleFromForm.bind(null, title.id);

  return (
    <main className="mx-auto max-w-xl px-6 py-14 pb-20">
      <Link
        href={`/admin/titles/${title.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to title
      </Link>

      <h1 className="mb-7 font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
        Edit title
      </h1>

      <form action={updateThisTitle} className="flex flex-col gap-5">
        <TitleDetailsFetcher
          defaultName={title.name}
          defaultSynopsis={title.synopsis ?? ""}
          defaultCoverImageUrl={title.coverImageUrl ?? ""}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="language">Language (ISO code) *</label>
            <input id="language" name="language" required defaultValue={title.language} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="countryOfOrigin">Country of origin</label>
            <input
              id="countryOfOrigin"
              name="countryOfOrigin"
              defaultValue={title.countryOfOrigin ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="tropeTags">Trope tags (comma-separated)</label>
          <input
            id="tropeTags"
            name="tropeTags"
            defaultValue={title.tropeTags.join(", ")}
            placeholder="revenge, billionaire"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="moodTags">Mood tags (comma-separated)</label>
          <input
            id="moodTags"
            name="moodTags"
            defaultValue={title.moodTags.join(", ")}
            placeholder="high_drama, longing"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="castType">Cast type</label>
          <input id="castType" name="castType" defaultValue={title.castType ?? ""} placeholder="unknown_cast" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="pacing">Pacing</label>
            <select id="pacing" name="pacing" defaultValue={title.pacing ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="fast">Fast</option>
              <option value="medium">Medium</option>
              <option value="slow">Slow</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="episodeCount">Episode count</label>
            <input
              id="episodeCount"
              name="episodeCount"
              type="number"
              min={0}
              defaultValue={title.episodeCount ?? undefined}
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--text)]">
          <input type="checkbox" name="isPublished" defaultChecked={title.isPublished} className="accent-[var(--accent-marigold)]" />
          Published
        </label>

        <button
          type="submit"
          className="mt-2 rounded-xl bg-[var(--accent-marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
        >
          Save changes
        </button>
      </form>
    </main>
  );
}
