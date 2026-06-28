"use client";

import { useState } from "react";

type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  stripePriceId: string;
};

type CheckoutResponse = {
  url?: string;
  error?: string;
};

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(priceCents / 100);
}

export function CreditPackageCheckout({
  locale,
  packages,
}: {
  locale: string;
  packages: CreditPackage[];
}) {
  const [pendingPriceId, setPendingPriceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        setMessage(
          response.status === 401
            ? "Please sign in before buying credits."
            : data.error ?? "Checkout failed.",
        );
        return;
      }

      window.location.href = data.url;
    } catch {
      setMessage("Checkout failed. Please try again.");
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

      <div className="grid gap-4 sm:grid-cols-3">
        {packages.map((creditPackage) => {
          const isPending = pendingPriceId === creditPackage.stripePriceId;

          return (
            <div
              key={creditPackage.id}
              className="rounded-[8px] border border-[#D2D2D7] bg-white p-5"
            >
              <div className="text-[13px] text-[#6E6E73]">{creditPackage.name}</div>
              <div className="mt-3 text-[32px] font-semibold leading-none text-[#1D1D1F]">
                {creditPackage.credits.toLocaleString()}
              </div>
              <div className="mt-1 text-[14px] text-[#6E6E73]">credits</div>
              <div className="mt-6 text-[20px] font-semibold text-[#1D1D1F]">
                {formatPrice(creditPackage.priceCents, creditPackage.currency)}
              </div>
              <button
                type="button"
                onClick={() => startCheckout(creditPackage.stripePriceId)}
                disabled={pendingPriceId !== null}
                className="mt-5 h-11 w-full rounded-[8px] bg-[#1D1D1F] px-4 text-[15px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#86868B]"
              >
                {isPending ? "Opening..." : "Buy"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
