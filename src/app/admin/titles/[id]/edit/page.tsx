import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { updateTitleFromForm } from "@/lib/adminForms";
import { TitleDetailsFetcher } from "@/components/admin/TitleDetailsFetcher";
import { TagPicker } from "@/components/admin/TagPicker";

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

  const otherTitles = await prisma.title.findMany({
    where: { id: { not: title.id } },
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
          defaultEpisodeCount={title.episodeCount ?? ""}
          defaultCastNames={title.castNames}
          defaultReleaseDate={title.releaseDate ? title.releaseDate.toISOString().slice(0, 10) : ""}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="language">Viewing language (ISO code) *</label>
            <input id="language" name="language" required defaultValue={title.language} className={inputClass} />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              What a viewer can actually watch this in on Kilig — not original production language.
            </p>
          </div>
          <div>
            <label className={labelClass} htmlFor="countryOfOrigin">Country of origin (optional)</label>
            <input
              id="countryOfOrigin"
              name="countryOfOrigin"
              defaultValue={title.countryOfOrigin ?? ""}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Not shown publicly yet — skip if unsure.</p>
          </div>
        </div>

        <TagPicker
          name="tropeTags"
          label="Trope tags"
          availableTags={tropeTagOptions}
          defaultValues={title.tropeTags}
          accent="trope"
        />

        <TagPicker
          name="moodTags"
          label="Mood tags"
          availableTags={moodTagOptions}
          defaultValues={title.moodTags}
          accent="mood"
        />

        <div>
          <label className={labelClass} htmlFor="castType">Cast type</label>
          <input id="castType" name="castType" defaultValue={title.castType ?? ""} placeholder="unknown_cast" className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="pacing">Pacing</label>
          <select id="pacing" name="pacing" defaultValue={title.pacing ?? ""} className={inputClass}>
            <option value="">—</option>
            <option value="fast">Fast</option>
            <option value="medium">Medium</option>
            <option value="slow">Slow</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="editorialHookPoint">Skip Meter — hook point</label>
            <select
              id="editorialHookPoint"
              name="editorialHookPoint"
              defaultValue={title.editorialHookPoint ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="hooks_fast">Hooks fast</option>
              <option value="slow_burn">Slow burn, worth it</option>
              <option value="filler_heavy">Filler-heavy</option>
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Judgeable from the first episode or two.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="editorialEndingType">Skip Meter — ending (optional)</label>
            <select
              id="editorialEndingType"
              name="editorialEndingType"
              defaultValue={title.editorialEndingType ?? ""}
              className={inputClass}
            >
              <option value="">— haven&apos;t finished it —</option>
              <option value="happy">Happy</option>
              <option value="bittersweet">Bittersweet</option>
              <option value="cliffhanger">Cliffhanger</option>
              <option value="unresolved">Unresolved</option>
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Only fill in once you&apos;ve actually finished it.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="seasonOfId">This is a season of (optional)</label>
            <select id="seasonOfId" name="seasonOfId" defaultValue={title.seasonOfId ?? ""} className={inputClass}>
              <option value="">— standalone title —</option>
              {otherTitles.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="seasonNumber">Season number</label>
            <input
              id="seasonNumber"
              name="seasonNumber"
              type="number"
              min={1}
              defaultValue={title.seasonNumber ?? undefined}
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
