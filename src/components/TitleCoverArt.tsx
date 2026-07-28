import type { Title } from "@/generated/prisma/client";

// Original gradient + type treatment for titles without licensed cover
// art yet (see ARCHITECTURE.md — real art should come from platform
// partners via Availability, not be generated or scraped). Picked
// deterministically per title id so the same title always gets the
// same treatment, and neighboring cards read as visually distinct
// rather than one repeated placeholder.
const FALLBACK_GRADIENTS = [
  "bg-gradient-to-br from-[#12131A] via-[#3a2a1f] to-[#E8A33D]",
  "bg-gradient-to-br from-[#12131A] via-[#3a1a24] to-[#D65F7A]",
  "bg-gradient-to-br from-[#12131A] via-[#2a1c30] to-[#D65F7A]",
  "bg-gradient-to-br from-[#12131A] via-[#332417] to-[#E8A33D]",
];

function pickGradient(id: string): string {
  const sum = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return FALLBACK_GRADIENTS[sum % FALLBACK_GRADIENTS.length];
}

interface TitleCoverArtProps {
  title: Pick<Title, "id" | "name" | "coverImageUrl">;
  // Callers size the overlaid title text themselves — a rail card and
  // a detail-page hero want very different scale — using a full
  // literal Tailwind class string (not an interpolated size value) for
  // the same static-scanner reason FALLBACK_GRADIENTS entries are
  // written out in full below.
  titleTextClassName?: string;
  // The detail-page hero sits directly above a real <h1> with the
  // same name — on mobile, where the layout stacks to one column,
  // showing the overlaid title there too reads as the name printed
  // twice in a row. Rail cards have no adjacent heading, so they
  // default to showing it.
  showTitleOverlay?: boolean;
}

export function TitleCoverArt({
  title,
  titleTextClassName = "text-base",
  showTitleOverlay = true,
}: TitleCoverArtProps) {
  if (title.coverImageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized source URLs from producers
    return <img src={title.coverImageUrl} alt={title.name} className="h-full w-full object-cover" />;
  }

  return (
    <div className={`flex h-full w-full items-start p-2.5 ${pickGradient(title.id)}`}>
      {showTitleOverlay && (
        <p
          className={`font-[var(--font-display)] font-bold uppercase leading-[1.05] text-[var(--accent-marigold)] ${titleTextClassName}`}
        >
          {title.name}
        </p>
      )}
    </div>
  );
}
