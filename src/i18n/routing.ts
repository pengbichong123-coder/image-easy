import { createNavigation } from "next-intl/navigation";

export const locales = [
  "en",
  "fr",
  "de",
  "es",
  "it",
  "nl",
  "zh",
  "ja",
  "ko",
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  nl: "Nederlands",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

export const localeHtmlLang: Record<Locale, string> = {
  en: "en",
  fr: "fr",
  de: "de",
  es: "es",
  it: "it",
  nl: "nl",
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
};

export const localeOgLocale: Record<Locale, string> = {
  en: "en_US",
  fr: "fr_FR",
  de: "de_DE",
  es: "es_ES",
  it: "it_IT",
  nl: "nl_NL",
  zh: "zh_CN",
  ja: "ja_JP",
  ko: "ko_KR",
};

export const pathnames = {
  "/": "/",
  "/create": "/create",
  "/creations": "/creations",
  "/login": "/login",
  "/pricing": "/pricing",
  "/billing": "/billing",
  "/privacy": "/privacy",
  "/terms": "/terms",
  "/contact": "/contact",
  "/about": "/about",
} as const;

export const routing = {
  locales,
  defaultLocale,
  localePrefix: "always" as const,
};

export function hasLocale(l: string): l is Locale {
  return (locales as readonly string[]).includes(l);
}

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({
    locales,
    pathnames,
    localePrefix: "always",
  });
