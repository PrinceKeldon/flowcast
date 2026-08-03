import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { createTitleFromForm } from "@/lib/adminForms";
import { TitleDetailsFetcher } from "@/components/admin/TitleDetailsFetcher";

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
        <TitleDetailsFetcher />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="language">Viewing language (ISO code) *</label>
            <input
              id="language"
              name="language"
              required
              defaultValue="en"
              placeholder="en"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              What a viewer can actually watch this in on Kilig — not original production language.
            </p>
          </div>
          <div>
            <label className={labelClass} htmlFor="countryOfOrigin">Country of origin (optional)</label>
            <input id="countryOfOrigin" name="countryOfOrigin" className={inputClass} />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Not shown publicly yet — skip if unsure.</p>
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

        <div>
          <label className={labelClass} htmlFor="castType">Cast type</label>
          <input id="castType" name="castType" placeholder="unknown_cast" className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="pacing">Pacing</label>
          <select id="pacing" name="pacing" defaultValue="" className={inputClass}>
            <option value="">—</option>
            <option value="fast">Fast</option>
            <option value="medium">Medium</option>
            <option value="slow">Slow</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="editorialHookPoint">Skip Meter — hook point</label>
            <select id="editorialHookPoint" name="editorialHookPoint" defaultValue="" className={inputClass}>
              <option value="">—</option>
              <option value="hooks_fast">Hooks fast</option>
              <option value="slow_burn">Slow burn, worth it</option>
              <option value="filler_heavy">Filler-heavy</option>
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Judgeable from the first episode or two.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="editorialEndingType">Skip Meter — ending (optional)</label>
            <select id="editorialEndingType" name="editorialEndingType" defaultValue="" className={inputClass}>
              <option value="">— haven&apos;t finished it —</option>
              <option value="happy">Happy</option>
              <option value="bittersweet">Bittersweet</option>
              <option value="cliffhanger">Cliffhanger</option>
              <option value="unresolved">Unresolved</option>
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Only fill in once you&apos;ve actually finished it.</p>
          </div>
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
