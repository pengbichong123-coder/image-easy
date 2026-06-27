import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://image-easy.app";

// Pages we expose for SEO. The login page is intentionally excluded
// (no value in indexing a sign-in URL).
const PAGES = ["/", "/create", "/my-images"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PAGES) {
    // x-default / canonical entry — en
    entries.push({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: path === "/" ? 1.0 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${SITE_URL}${l === "en" ? path : `/${l}${path}`}`]),
        ),
      },
    });

    // Non-en locales get their own entry too
    for (const l of locales) {
      if (l === "en") continue;
      entries.push({
        url: `${SITE_URL}/${l}${path}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: path === "/" ? 0.9 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            locales.map((ll) => [
              ll,
              `${SITE_URL}${ll === "en" ? path : `/${ll}${path}`}`,
            ]),
          ),
        },
      });
    }
  }

  return entries;
}
