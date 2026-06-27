import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://image-easy.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/en", "/en/*", "/fr", "/fr/*", "/de", "/de/*", "/es", "/es/*", "/it", "/it/*", "/nl", "/nl/*", "/zh", "/zh/*", "/ja", "/ja/*", "/ko", "/ko/*"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
