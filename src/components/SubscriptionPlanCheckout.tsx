"use client";

import { useMemo, useState } from "react";
import type { SubscriptionPlan } from "@/lib/subscription-plans";

type CheckoutResponse = {
  url?: string;
  error?: string;
};

type CheckoutLabels = {
  signInRequired: string;
  failed: string;
  opening: string;
  buy: string;
  monthly: string;
  annual: string;
  perMonth: string;
  perYear: string;
  creditsPerMonth: string;
  annualBadge: string;
};

function formatPrice(priceCents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(priceCents / 100);
}

export function SubscriptionPlanCheckout({
  labels,
  locale,
  plans,
}: {
  labels: CheckoutLabels;
  locale: string;
  plans: SubscriptionPlan[];
}) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [pendingPriceId, setPendingPriceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const visiblePlans = useMemo(
    () => plans.filter((plan) => plan.interval === interval && plan.stripePriceId),
    [interval, plans],
  );

  async function startCheckout(priceId: string) {
    setPendingPriceId(priceId);
    setMessage(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId, locale }),
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || !data.url) {
        setMessage(response.status === 401 ? labels.signInRequired : labels.failed);
        return;
      }

      window.location.href = data.url;
    } catch {
      setMessage(labels.failed);
    } finally {
      setPendingPriceId(null);
    }
  }

  return (
    <div>
      {message ? (
        <div className="mb-5 rounded-[8px] border border-[#F5C2C7] bg-[#FFF5F5] px-4 py-3 text-[14px] text-[#8A1F2D]">
          {message}
        </div>
      ) : null}

      <div className="mb-5 inline-flex rounded-full bg-[#F5F5F7] p-1">
        {(["month", "year"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setInterval(option)}
            className={[
              "h-9 rounded-full px-4 text-[14px] transition",
              interval === option ? "bg-[#1D1D1F] text-white" : "text-[#6E6E73] hover:text-[#1D1D1F]",
            ].join(" ")}
          >
            {option === "month" ? labels.monthly : labels.annual}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {visiblePlans.map((plan) => {
          const isPending = pendingPriceId === plan.stripePriceId;

          return (
            <div
              key={plan.id}
              className="rounded-[8px] border border-[#D2D2D7] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[13px] text-[#6E6E73]">{plan.name}</div>
                {plan.interval === "year" ? (
                  <span className="rounded-full bg-[#EAF3FF] px-2 py-1 text-[11px] text-[#0066CC]">
                    {labels.annualBadge}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-[32px] font-semibold leading-none text-[#1D1D1F]">
                {plan.monthlyCredits.toLocaleString()}
              </div>
              <div className="mt-1 text-[14px] text-[#6E6E73]">{labels.creditsPerMonth}</div>
              <div className="mt-6 text-[20px] font-semibold text-[#1D1D1F]">
                {formatPrice(plan.priceCents, plan.currency, locale)}
                <span className="ml-1 text-[13px] font-normal text-[#6E6E73]">
                  {plan.interval === "year" ? labels.perYear : labels.perMonth}
                </span>
              </div>
              <button
                type="button"
                onClick={() => plan.stripePriceId && startCheckout(plan.stripePriceId)}
                disabled={pendingPriceId !== null || !plan.stripePriceId}
                className="mt-5 h-11 w-full rounded-[8px] bg-[#1D1D1F] px-4 text-[15px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#86868B]"
              >
                {isPending ? labels.opening : labels.buy}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
