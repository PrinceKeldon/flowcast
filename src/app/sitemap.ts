import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  // No domain registered yet — an empty sitemap is harmless (Next
  // just serves an empty <urlset>), but every entry needs an absolute
  // URL, so there's nothing honest to generate without one.
  if (!siteUrl) return [];

  const titles = await prisma.title.findMany({
    where: { isPublished: true },
    select: { id: true, updatedAt: true },
  });

  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/search`, changeFrequency: "weekly", priority: 0.5 },
    ...titles.map((title) => ({
      url: `${siteUrl}/title/${title.id}`,
      lastModified: title.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
