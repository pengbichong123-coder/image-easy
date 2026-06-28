"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

export function BillingPortalButton({
  label,
  loadingLabel,
  errorLabel,
}: {
  label: string;
  loadingLabel: string;
  errorLabel: string;
}) {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = (await response.json()) as { url?: string };

      if (!response.ok || !data.url) {
        setError(errorLabel);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError(errorLabel);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? loadingLabel : label}
      </button>
      {error ? <p className="mt-3 text-[13px] text-[#D70015]">{error}</p> : null}
    </div>
  );
}
