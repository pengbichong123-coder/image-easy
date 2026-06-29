import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutSessionRefresh } from "@/components/CheckoutSessionRefresh";
import { SiteFooter } from "@/components/SiteFooter";
import { SubscriptionPlanCheckout } from "@/components/SubscriptionPlanCheckout";
import { GENERATION_CREDIT_COST_ROWS } from "@/lib/generation-credit-cost";
import { isPaidCreditsEnabled } from "@/lib/pricing-mode";
import { getConfiguredSubscriptionPlans } from "@/lib/subscription-plans";

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
  const paidCreditsEnabled = isPaidCreditsEnabled(process.env.ENABLE_PAID_CREDITS);
  const checkoutStatus = Array.isArray(resolvedSearchParams?.checkout)
    ? resolvedSearchParams.checkout[0]
    : resolvedSearchParams?.checkout;
  const checkoutSucceeded = checkoutStatus === "success";
  const subscriptionPlans = paidCreditsEnabled ? getConfiguredSubscriptionPlans() : [];

  return (
    <div className="bg-white">
      <CheckoutSessionRefresh active={checkoutSucceeded} />
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

        {subscriptionPlans.length > 0 ? (
          <div className="mt-14 border-t border-[#D2D2D7] pt-10">
            <div className="text-[13px] text-[#6E6E73] mb-3">
              {t("planEyebrow")}
            </div>
            <h2 className="display text-[34px] sm:text-[44px] text-[#1D1D1F] mb-4">
              {t("subscriptionTitle")}
            </h2>
            {checkoutSucceeded ? (
              <div className="mb-6 rounded-[8px] border border-[#B7E4C7] bg-[#F1FFF6] px-4 py-3 text-[14px] text-[#17633A]">
                {t("checkoutSuccess")}
              </div>
            ) : null}
            {checkoutStatus === "cancel" ? (
              <div className="mb-6 rounded-[8px] border border-[#F1D6A7] bg-[#FFF9EF] px-4 py-3 text-[14px] text-[#7A4E00]">
                {t("checkoutCancel")}
              </div>
            ) : null}
            <SubscriptionPlanCheckout
              labels={{
                signInRequired: t("checkoutSignInRequired"),
                failed: t("checkoutFailed"),
                opening: t("checkoutOpening"),
                buy: t("checkoutBuy"),
                monthly: t("billingMonthly"),
                annual: t("billingAnnual"),
                perMonth: t("perMonth"),
                perYear: t("perYear"),
                creditsPerMonth: t("creditsPerMonth"),
                creditsPerYear: t("creditsPerYear"),
                annualBadge: t("annualBadge"),
              }}
              locale={locale}
              plans={subscriptionPlans}
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

        <div className="mt-10 border-t border-[#E5E5E7] pt-10">
          <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">
            {t("costTableTitle")}
          </h2>
          <p className="text-[16px] leading-[1.6] text-[#6E6E73] mb-6">
            {t("costTableLead")}
          </p>
          <div className="overflow-hidden rounded-[8px] border border-[#E5E5E7]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[#F5F5F7] text-[#6E6E73]">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("costTableModel")}</th>
                  <th className="px-4 py-3 font-medium">{t("costTableSpec")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("costTableCredits")}</th>
                </tr>
              </thead>
              <tbody>
                {GENERATION_CREDIT_COST_ROWS.map((row) => (
                  <tr key={`${row.model}-${row.spec}`} className="border-t border-[#E5E5E7]">
                    <td className="px-4 py-3 text-[#1D1D1F]">{row.model}</td>
                    <td className="px-4 py-3 text-[#6E6E73]">{row.spec}</td>
                    <td className="px-4 py-3 text-[#1D1D1F] text-right tabular">
                      {t("costTableCreditValue", { credits: row.credits })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <SiteFooter variant="full" />
    </div>
  );
}
