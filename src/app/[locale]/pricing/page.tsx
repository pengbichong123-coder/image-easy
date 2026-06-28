import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreditPackageCheckout } from "@/components/CreditPackageCheckout";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ checkout?: string | string[] }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trust.pricing" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PricingPage({ params, searchParams }: PageProps) {
  await connection();

  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("trust.pricing");
  const resolvedSearchParams = await searchParams;
  const checkoutStatus = Array.isArray(resolvedSearchParams?.checkout)
    ? resolvedSearchParams.checkout[0]
    : resolvedSearchParams?.checkout;
  const creditPackages = await prisma.creditPackage.findMany({
    where: { active: true },
    orderBy: [
      { priceCents: "asc" },
      { credits: "asc" },
    ],
    select: {
      id: true,
      name: true,
      credits: true,
      priceCents: true,
      currency: true,
      stripePriceId: true,
    },
  });

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

        {creditPackages.length > 0 ? (
          <div className="mt-14 border-t border-[#D2D2D7] pt-10">
            <div className="text-[13px] text-[#6E6E73] mb-3">
              {t("planEyebrow")}
            </div>
            <h2 className="display text-[34px] sm:text-[44px] text-[#1D1D1F] mb-4">
              {t("planLabel")}
            </h2>
            {checkoutStatus === "success" ? (
              <div className="mb-6 rounded-[8px] border border-[#B7E4C7] bg-[#F1FFF6] px-4 py-3 text-[14px] text-[#17633A]">
                {t("checkoutSuccess")}
              </div>
            ) : null}
            {checkoutStatus === "cancel" ? (
              <div className="mb-6 rounded-[8px] border border-[#F1D6A7] bg-[#FFF9EF] px-4 py-3 text-[14px] text-[#7A4E00]">
                {t("checkoutCancel")}
              </div>
            ) : null}
            <CreditPackageCheckout
              labels={{
                signInRequired: t("checkoutSignInRequired"),
                failed: t("checkoutFailed"),
                opening: t("checkoutOpening"),
                buy: t("checkoutBuy"),
                credits: t("creditsLabel"),
              }}
              locale={locale}
              packages={creditPackages}
            />
          </div>
        ) : (
          <div className="mt-14 border-t border-[#D2D2D7] pt-10">
            <div className="text-[13px] text-[#6E6E73] mb-3">
              {t("planEyebrow")}
            </div>
            <h2 className="display text-[34px] sm:text-[44px] text-[#1D1D1F] mb-4">
              {t("planLabel")}
            </h2>
            <div className="space-y-4 text-[18px] leading-[1.5] text-[#1D1D1F]">
              <p>{t("planLine1")}</p>
              <p>{t("planLine2")}</p>
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-[#E5E5E7] pt-10">
          <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">
            {t("detailsTitle")}
          </h2>
          <div className="space-y-4 text-[16px] leading-[1.6] text-[#6E6E73]">
            <p>{t("detailsBody1")}</p>
            <p>{t("detailsBody2")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
