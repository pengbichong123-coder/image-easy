import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { SiteFooter } from "@/components/SiteFooter";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trust.legal" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function LegalPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <LegalDocumentPage
        namespace="trust.legal"
        sections={[
          "operator",
          "ip",
          "copyright",
          "thirdParty",
          "lawRequests",
          "contact",
        ]}
      />
      <SiteFooter variant="full" />
    </>
  );
}
