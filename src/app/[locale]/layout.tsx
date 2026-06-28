import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Header } from "@/components/Header";
import {
  hasLocale,
  type Locale,
  localeHtmlLang,
  localeOgLocale,
  locales,
} from "@/i18n/routing";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://image-easy.app";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const currentLocale = locale as Locale;

  const t = await getTranslations({ locale, namespace: "metadata" });
  const localeUrl = `${SITE_URL}/${currentLocale}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("title"),
      template: `%s · Image Easy`,
    },
    description: t("description"),
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("title"),
      description: t("ogDescription"),
      url: localeUrl,
      locale: localeOgLocale[currentLocale],
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => localeOgLocale[l]),
      images: [
        {
          url: `${SITE_URL}/og?lang=${locale}`,
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("ogDescription"),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  setRequestLocale(locale);

  const session = await auth();
  const messages = await getMessages();

  return (
    <html lang={localeHtmlLang[locale as Locale]}>
      <body>
        <GoogleAnalytics />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SessionProvider session={session}>
            <Header />
            <main className="pt-12 min-h-screen">{children}</main>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
