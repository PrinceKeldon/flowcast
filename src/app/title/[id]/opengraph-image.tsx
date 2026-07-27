import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kilig";

// Same treatment as TitleCoverArt.tsx, re-expressed in plain CSS since
// ImageResponse renders via Satori, not a real browser — no Tailwind
// classes here, only inline styles / literal CSS strings.
const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #12131A 0%, #3a2a1f 55%, #E8A33D 100%)",
  "linear-gradient(135deg, #12131A 0%, #3a1a24 55%, #D65F7A 100%)",
  "linear-gradient(135deg, #12131A 0%, #2a1c30 55%, #D65F7A 100%)",
  "linear-gradient(135deg, #12131A 0%, #332417 55%, #E8A33D 100%)",
];

function pickGradient(id: string): string {
  const sum = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return FALLBACK_GRADIENTS[sum % FALLBACK_GRADIENTS.length];
}

interface OgImageProps {
  params: Promise<{ id: string }>;
}

export default async function Image({ params }: OgImageProps) {
  const { id } = await params;

  const title = await prisma.title.findUnique({
    where: { id },
    select: { id: true, name: true, coverImageUrl: true, isPublished: true },
  });

  // Same draft-privacy rule as generateMetadata and the page body —
  // don't leak a draft's name into a generated share image either.
  const visible = title && (title.isPublished || (await isAdminSession()));

  if (visible && title.coverImageUrl) {
    // Real licensed art already exists — hand crawlers the actual
    // image instead of re-rendering it. Social/link-preview crawlers
    // follow redirects on image URLs fine.
    return Response.redirect(title.coverImageUrl);
  }

  const displayName = visible ? title.name : "Kilig";
  const gradient = pickGradient(visible ? title.id : id);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "72px",
          backgroundImage: gradient,
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, textTransform: "uppercase", color: "#8B8D98" }}>
          KILIG
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            color: "#F1EEE6",
            textTransform: "uppercase",
            lineHeight: 1.05,
            marginTop: 16,
            maxWidth: 950,
          }}
        >
          {displayName}
        </div>
      </div>
    ),
    size
  );
}
