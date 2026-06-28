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
  const t = await getTranslations({ locale, namespace: "trust.privacy" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <LegalDocumentPage
        namespace="trust.privacy"
        sections={[
          "account",
          "content",
          "providers",
          "payments",
          "security",
          "retention",
          "rights",
          "children",
          "changes",
          "contact",
        ]}
      />
      <SiteFooter variant="full" />
    </>
  );
}
