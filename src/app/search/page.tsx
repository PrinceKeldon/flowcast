import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { logSearch } from "@/lib/actions";
import { SearchBar } from "@/components/SearchBar";
import { TitleCard } from "@/components/TitleCard";

export const dynamic = "force-dynamic"; // results depend on live query params

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results = query
    ? await prisma.title.findMany({
        where: {
          isPublished: true,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { synopsis: { contains: query, mode: "insensitive" } },
            { language: { equals: query, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      })
    : [];

  // Fire-and-forget — now persisted to SearchLog (see schema.prisma).
  if (query) logSearch(query, {}, results.length);

  return (
    <main className="mx-auto max-w-6xl px-6 py-14 pb-20">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-marigold)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back
      </Link>

      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Search</p>
      <SearchBar defaultValue={query} />

      {!query && <p className="text-[var(--text-muted)]">Type something above to find a title.</p>}

      {query && results.length === 0 && (
        <p className="text-[var(--text-muted)]">
          No titles found for &ldquo;{query}&rdquo;. Try a different name, or browse by mood on the{" "}
          <Link href="/" className="text-[var(--accent-marigold)] hover:underline">
            home page
          </Link>
          .
        </p>
      )}

      {results.length > 0 && (
        <>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
          </p>
          <div className="flex flex-wrap gap-4">
            {results.map((title) => (
              <TitleCard key={title.id} title={title} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
