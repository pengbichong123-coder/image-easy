import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
  const t = await getTranslations("trust.privacy");

  return (
    <div className="bg-white">
      <section className="max-w-[860px] mx-auto px-5 py-20 sm:py-28">
        <div className="text-[14px] text-[#6E6E73] mb-3">
          {t("kicker")}
        </div>
        <h1 className="display text-[48px] sm:text-[64px] text-[#1D1D1F] mb-5">
          {t("title")}
        </h1>
        <p className="text-[19px] sm:text-[21px] leading-[1.4] text-[#6E6E73] max-w-[720px]">
          {t("lead")}
        </p>

        <div className="mt-14 border-t border-[#D2D2D7] pt-10">
          <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-5">
            {t("summaryTitle")}
          </h2>
          <div className="space-y-5 text-[17px] leading-[1.6] text-[#1D1D1F]">
            <p>{t("summaryUpload")}</p>
            <p>{t("summaryProvider")}</p>
            <p>{t("summaryStorage")}</p>
          </div>
        </div>

        <div className="mt-10 border-t border-[#E5E5E7] pt-10">
          <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">
            {t("betaTitle")}
          </h2>
          <div className="space-y-4 text-[16px] leading-[1.6] text-[#6E6E73]">
            <p>{t("betaBody1")}</p>
            <p>{t("betaBody2")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
