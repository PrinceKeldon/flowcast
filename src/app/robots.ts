import type { MetadataRoute } from "next";

// NEXT_PUBLIC_SITE_URL isn't set yet because the domain isn't
// registered — set this once it is (see .env.example). Until then,
// this omits the sitemap reference rather than guessing a domain.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/"],
    },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
