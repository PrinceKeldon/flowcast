import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { addAvailabilityFromForm, addReactionFromForm } from "@/lib/adminForms";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-marigold)] focus:outline-none";
const labelClass = "mb-1.5 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]";

interface AdminTitleDetailProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTitleDetailPage({ params }: AdminTitleDetailProps) {
  if (!(await isAdminSession())) redirect("/admin/login");

  const { id } = await params;
  const title = await prisma.title.findUnique({
    where: { id },
    include: { availability: true, reactions: { orderBy: { displayOrder: "asc" } } },
  });
  if (!title) notFound();

  const addAvailabilityForThisTitle = addAvailabilityFromForm.bind(null, title.id);
  const addReactionForThisTitle = addReactionFromForm.bind(null, title.id);

  return (
    <main className="mx-auto max-w-xl px-6 py-14 pb-20">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to admin
      </Link>

      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {title.isPublished ? "Published" : "Draft"} · {title.language.toUpperCase()}
      </p>
      <h1 className="mb-2 font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
        {title.name}
      </h1>
      <Link
        href={`/title/${title.id}`}
        className="mb-7 inline-block text-sm text-[var(--accent-marigold)] hover:underline"
      >
        View public page →
      </Link>

      {/* Existing availability */}
      <section className="mb-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          Availability ({title.availability.length})
        </p>
        {title.availability.length > 0 && (
          <ul className="mb-4 flex flex-col gap-1.5">
            {title.availability.map((a) => (
              <li key={a.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                <span className="font-semibold">{a.platform}</span>{" "}
                <span className="text-[var(--text-muted)]">— {a.priceModel.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        )}
        <details className="rounded-xl border border-[var(--border)] p-4">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
            + Add availability
          </summary>
          <form action={addAvailabilityForThisTitle} className="mt-4 flex flex-col gap-3">
            <div>
              <label className={labelClass} htmlFor="platform">Platform *</label>
              <input id="platform" name="platform" required placeholder="ReelShort" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="deepLinkUrl">Deep link URL *</label>
              <input id="deepLinkUrl" name="deepLinkUrl" type="url" required className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="priceModel">Price model *</label>
                <select id="priceModel" name="priceModel" required defaultValue="" className={inputClass}>
                  <option value="" disabled>Choose one</option>
                  <option value="free">Free</option>
                  <option value="pay_per_unlock">Pay per unlock</option>
                  <option value="subscription">Subscription</option>
                  <option value="ad_supported">Ad supported</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="priceAmountCents">Price (cents)</label>
                <input id="priceAmountCents" name="priceAmountCents" type="number" min={0} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="regionAvailability">Regions (comma-separated)</label>
              <input id="regionAvailability" name="regionAvailability" placeholder="US, DE, KE" className={inputClass} />
            </div>
            <button
              type="submit"
              className="mt-1 rounded-xl bg-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
            >
              Add availability
            </button>
          </form>
        </details>
      </section>

      {/* Existing reactions */}
      <section>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          Reactions ({title.reactions.length})
        </p>
        {title.reactions.length > 0 && (
          <ul className="mb-4 flex flex-col gap-1.5">
            {title.reactions.map((r) => (
              <li key={r.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                {r.emoji} &ldquo;{r.quoteText}&rdquo;{" "}
                {r.authorHandle && <span className="text-[var(--text-muted)]">{r.authorHandle}</span>}
              </li>
            ))}
          </ul>
        )}
        <details className="rounded-xl border border-[var(--border)] p-4">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
            + Add reaction
          </summary>
          <form action={addReactionForThisTitle} className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <div>
                <label className={labelClass} htmlFor="emoji">Emoji *</label>
                <input id="emoji" name="emoji" required placeholder="🔥" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="authorHandle">Author handle</label>
                <input id="authorHandle" name="authorHandle" placeholder="@dramaaddict" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="quoteText">Quote *</label>
              <textarea id="quoteText" name="quoteText" rows={2} required className={inputClass} />
            </div>
            <button
              type="submit"
              className="mt-1 rounded-xl bg-[var(--accent-marigold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
            >
              Add reaction
            </button>
          </form>
        </details>
      </section>
    </main>
  );
}
