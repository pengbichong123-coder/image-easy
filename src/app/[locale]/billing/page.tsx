import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BillingPortalButton } from "@/components/BillingPortalButton";
import { auth } from "@/lib/auth";
import { getBillingOverview } from "@/lib/billing-overview";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing" });

  return {
    title: t("metaTitle"),
  };
}

function formatDate(value: Date | null | undefined, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

function formatDateTime(value: Date | null | undefined, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(value);
}

function formatMoney(amountCents: number | null, currency: string | null, locale: string) {
  if (typeof amountCents !== "number" || !currency) return "-";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatPlan(tier: string, interval: string) {
  return `${tier.charAt(0).toUpperCase()}${tier.slice(1)} / ${interval}`;
}

function formatPlanCredits(
  subscription: { interval: string; monthlyCredits: number } | null | undefined,
  labels: { month: string; year: string },
) {
  if (!subscription) return "-";
  const isAnnual = subscription.interval === "year";
  const credits = isAnnual ? subscription.monthlyCredits * 12 : subscription.monthlyCredits;
  return `${credits.toLocaleString()} ${isAnnual ? labels.year : labels.month}`;
}

function formatCreditAmount(amount: number) {
  return amount > 0 ? `+${amount}` : String(amount);
}

export default async function BillingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/billing`);
  }

  const t = await getTranslations("billing");
  const overview = await getBillingOverview(session.user.id);
  const subscription = overview.subscription;
  const paymentFailed = subscription?.status === "past_due" || subscription?.status === "unpaid";
  const creditTypeLabels: Record<string, string> = {
    grant: t("creditTypeGrant"),
    reserve: t("creditTypeReserve"),
    consume: t("creditTypeConsume"),
    refund: t("creditTypeRefund"),
    purchase: t("creditTypePurchase"),
    subscription_grant: t("creditTypeSubscriptionGrant"),
    admin_adjust: t("creditTypeAdminAdjust"),
  };
  const statusLabels: Record<string, string> = {
    active: t("statusActive"),
    trialing: t("statusTrialing"),
    past_due: t("statusPastDue"),
    unpaid: t("statusUnpaid"),
    canceled: t("statusCanceled"),
    incomplete: t("statusIncomplete"),
    incomplete_expired: t("statusExpired"),
  };

  return (
    <main className="max-w-[980px] mx-auto px-5 py-20 sm:py-28">
      <div className="text-[14px] text-[#6E6E73] mb-3">{t("kicker")}</div>
      <h1 className="display text-[48px] sm:text-[64px] text-[#1D1D1F] mb-5">
        {t("title")}
      </h1>
      <p className="text-[19px] text-[#6E6E73] max-w-2xl">{t("lead")}</p>

      {paymentFailed ? (
        <div className="mt-8 rounded-[8px] border border-[#F1D6A7] bg-[#FFF9EF] px-4 py-3 text-[14px] text-[#7A4E00]">
          <strong>{t("paymentFailedTitle")}</strong>
          <p className="mt-1">{t("paymentFailedBody")}</p>
        </div>
      ) : null}

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[8px] border border-[#E5E5E7] p-5">
          <div className="text-[13px] text-[#6E6E73]">{t("currentCredits")}</div>
          <div className="mt-3 text-[36px] font-semibold text-[#1D1D1F]">
            {overview.credits.toLocaleString()}
          </div>
        </div>
        <div className="rounded-[8px] border border-[#E5E5E7] p-5 sm:col-span-2">
          <div className="text-[13px] text-[#6E6E73]">{t("currentPlan")}</div>
          <div className="mt-3 text-[28px] font-semibold text-[#1D1D1F]">
            {subscription ? formatPlan(subscription.tier, subscription.interval) : t("noPlan")}
          </div>
          <div className="mt-3 grid gap-2 text-[14px] text-[#6E6E73] sm:grid-cols-2">
            <div>
              {t("status")}: {subscription?.status ? (statusLabels[subscription.status] ?? t("statusUnknown")) : t("statusUnknown")}
            </div>
            <div>
              {t("planCredits")}: {formatPlanCredits(subscription, {
                month: t("creditsPerMonth"),
                year: t("creditsPerYear"),
              })}
            </div>
            <div>{t("periodEnd")}: {formatDate(subscription?.currentPeriodEnd, locale)}</div>
          </div>
          {subscription?.stripeCustomerId ? (
            <div className="mt-5">
              <BillingPortalButton
                label={t("manageSubscription")}
                loadingLabel={t("portalOpening")}
                errorLabel={t("portalFailed")}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">
          {t("creditHistory")}
        </h2>
        {overview.creditTransactions.length === 0 ? (
          <p className="text-[#6E6E73]">{t("emptyCreditHistory")}</p>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-[#E5E5E7]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[#F5F5F7] text-[#6E6E73]">
                <tr>
                  <th className="px-4 py-3">{t("time")}</th>
                  <th className="px-4 py-3">{t("type")}</th>
                  <th className="px-4 py-3 text-right">{t("amount")}</th>
                  <th className="px-4 py-3 text-right">{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.creditTransactions.map((item) => (
                  <tr key={item.id} className="border-t border-[#E5E5E7]">
                    <td className="px-4 py-3 text-[#6E6E73]">{formatDateTime(item.createdAt, locale)}</td>
                    <td className="px-4 py-3 text-[#1D1D1F]">
                      {creditTypeLabels[item.type] ?? t("creditTypeOther")}
                    </td>
                    <td className="px-4 py-3 text-right tabular">{formatCreditAmount(item.amount)}</td>
                    <td className="px-4 py-3 text-right tabular">{item.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">
          {t("billingHistory")}
        </h2>
        {overview.billingEvents.length === 0 ? (
          <p className="text-[#6E6E73]">{t("emptyBillingHistory")}</p>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-[#E5E5E7]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[#F5F5F7] text-[#6E6E73]">
                <tr>
                  <th className="px-4 py-3">{t("time")}</th>
                  <th className="px-4 py-3">{t("type")}</th>
                  <th className="px-4 py-3 text-right">{t("amount")}</th>
                  <th className="px-4 py-3 text-right">{t("invoice")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.billingEvents.map((item) => (
                  <tr key={item.id} className="border-t border-[#E5E5E7]">
                    <td className="px-4 py-3 text-[#6E6E73]">{formatDate(item.occurredAt, locale)}</td>
                    <td className="px-4 py-3 text-[#1D1D1F]">{item.description ?? item.type}</td>
                    <td className="px-4 py-3 text-right tabular">
                      {formatMoney(item.amountCents, item.currency, locale)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.hostedInvoiceUrl ? (
                        <a
                          href={item.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0066CC] hover:underline"
                        >
                          {t("viewInvoice")}
                        </a>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
