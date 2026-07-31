import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isAdminSession } from "@/lib/admin";
import { getRegisteredSources } from "@/lib/discovery/mission";
import { DiscoveryMissionRunner } from "@/components/admin/DiscoveryMissionRunner";

export default async function DiscoveryPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const sources = await getRegisteredSources();

  return (
    <main className="mx-auto max-w-2xl px-6 py-14 pb-20">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to admin
      </Link>

      <h1 className="mb-2 font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
        Discovery
      </h1>
      <p className="mb-7 text-sm text-[var(--text-muted)]">
        Run a mission against a source plugin. Every imported title lands unpublished — nothing goes live without
        being reviewed on its own title page first.
      </p>

      <DiscoveryMissionRunner sources={sources} />
    </main>
  );
}
