import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  locales,
  hasLocale,
  localeOgLocale,
  type Locale,
} from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://image-easy.app";

type PageKey = "home" | "create" | "my-images" | "login";

// Each page has its own dict namespace; titles/descriptions are read from
// the page's own namespace so that lookups never cross namespaces.
const NS: Record<PageKey, string> = {
  home: "home",
  create: "create",
  "my-images": "archive",
  login: "auth",
};

function localizedPath(locale: Locale, pathname: string) {
  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}

function localizedUrl(locale: Locale, pathname: string) {
  return `${SITE_URL}${localizedPath(locale, pathname)}`;
}

export async function generatePageMetadata({
  locale,
  page,
}: {
  locale: string;
  page: PageKey;
}): Promise<Metadata> {
  if (!hasLocale(locale)) return {};
  const currentLocale = locale as Locale;
  const ns = NS[page];
  const t = await getTranslations({ locale, namespace: ns });

  // Page-specific title/description.
  // For "home" we pull from the metadata namespace (which has site title).
  const metaT = await getTranslations({ locale, namespace: "metadata" });

  const title =
    page === "home"
      ? metaT("title")
      : page === "create"
      ? t("titleA") + " " + t("titleEm") + t("titleB")
      : page === "my-images"
      ? t("titleA") + " " + t("titleEm") + t("titleB")
      : t("loginTitleA") + " " + t("loginTitleEm") + t("loginTitleB");

  const description =
    page === "home"
      ? metaT("description")
      : page === "create"
      ? t("lead")
      : page === "my-images"
      ? t("emptyText")
      : t("loginLead");

  const pathname = page === "home" ? "/" : `/${page}`;

  // hreflang block: this page in all 9 locales
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = localizedUrl(l, pathname);
  }
  languages["x-default"] = localizedUrl("en", pathname);

  return {
    title,
    description,
    alternates: {
      canonical: localizedUrl(currentLocale, pathname),
      languages,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: localizedUrl(currentLocale, pathname),
      locale: localeOgLocale[currentLocale],
      alternateLocale: locales
        .filter((l) => l !== currentLocale)
        .map((l) => localeOgLocale[l]),
    },
  };
}
