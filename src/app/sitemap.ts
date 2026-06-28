import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://image-easy.app";

// Pages we expose for SEO. Private and sign-in pages are intentionally excluded.
const PAGES = ["/", "/create"] as const;

function localizedPath(locale: Locale, path: (typeof PAGES)[number]) {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

function localizedUrl(locale: Locale, path: (typeof PAGES)[number]) {
  return `${SITE_URL}${localizedPath(locale, path)}`;
}

function alternateLanguages(path: (typeof PAGES)[number]) {
  return {
    ...Object.fromEntries(locales.map((l) => [l, localizedUrl(l, path)])),
    "x-default": localizedUrl("en", path),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PAGES) {
    for (const locale of locales) {
      entries.push({
        url: localizedUrl(locale, path),
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: path === "/" && locale === "en" ? 1.0 : path === "/" ? 0.9 : 0.7,
        alternates: {
          languages: alternateLanguages(path),
        },
      });
    }
  }

  return entries;
}
