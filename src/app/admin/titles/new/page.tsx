import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { createTitleFromForm } from "@/lib/adminForms";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none";
const labelClass = "mb-1.5 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]";

export default async function NewTitlePage() {
  if (!(await isAdminSession())) redirect("/admin/login");

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

      <form action={createTitleFromForm} className="flex flex-col gap-5">
        <div>
          <label className={labelClass} htmlFor="name">Name *</label>
          <input id="name" name="name" required className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="synopsis">Synopsis</label>
          <textarea id="synopsis" name="synopsis" rows={3} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="language">Language (ISO code) *</label>
            <input id="language" name="language" required placeholder="en" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="countryOfOrigin">Country of origin</label>
            <input id="countryOfOrigin" name="countryOfOrigin" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="tropeTags">Trope tags (comma-separated)</label>
          <input id="tropeTags" name="tropeTags" placeholder="revenge, billionaire" className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="moodTags">Mood tags (comma-separated)</label>
          <input id="moodTags" name="moodTags" placeholder="high_drama, longing" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="pacing">Pacing</label>
            <select id="pacing" name="pacing" defaultValue="" className={inputClass}>
              <option value="">—</option>
              <option value="fast">Fast</option>
              <option value="medium">Medium</option>
              <option value="slow">Slow</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="episodeCount">Episode count</label>
            <input id="episodeCount" name="episodeCount" type="number" min={0} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="coverImageUrl">Cover image URL</label>
          <input id="coverImageUrl" name="coverImageUrl" type="url" className={inputClass} />
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--text)]">
          <input type="checkbox" name="isPublished" className="accent-[var(--accent-marigold)]" />
          Publish immediately
        </label>

        <button
          type="submit"
          className="mt-2 rounded-xl bg-[var(--accent-marigold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
        >
          Create title
        </button>
      </form>
    </main>
  );
}
