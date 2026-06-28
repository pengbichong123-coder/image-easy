export type PricingEnvironment = "sandbox" | "production";
export type PricingTier = "starter" | "creator" | "studio";
export type PricingBillingType = "subscription";
export type PricingInterval = "month" | "year";

export type PricingPlanConfig = {
  id: string;
  tier: PricingTier;
  billingType: PricingBillingType;
  interval: PricingInterval;
  name: string;
  monthlyCredits: number;
  priceCents: number;
  currency: "usd";
  stripePriceIds: Record<PricingEnvironment, string | null>;
};

export const PRICING_CONFIG = {
  defaultEnvironment: "sandbox",
  environmentEnvKey: "STRIPE_PRICE_ENV",
  plans: [
    {
      id: "starter-monthly",
      tier: "starter",
      billingType: "subscription",
      interval: "month",
      name: "Starter",
      monthlyCredits: 800,
      priceCents: 990,
      currency: "usd",
      stripePriceIds: {
        sandbox: "price_1TnHcw6B6kkgkutj66Pd9Izw",
        production: null,
      },
    },
    {
      id: "creator-monthly",
      tier: "creator",
      billingType: "subscription",
      interval: "month",
      name: "Creator",
      monthlyCredits: 2500,
      priceCents: 2990,
      currency: "usd",
      stripePriceIds: {
        sandbox: "price_1TnHcx6B6kkgkutjCKlwogKT",
        production: null,
      },
    },
    {
      id: "studio-monthly",
      tier: "studio",
      billingType: "subscription",
      interval: "month",
      name: "Studio",
      monthlyCredits: 6500,
      priceCents: 6990,
      currency: "usd",
      stripePriceIds: {
        sandbox: "price_1TnHcy6B6kkgkutjD4Y22764",
        production: null,
      },
    },
    {
      id: "starter-annual",
      tier: "starter",
      billingType: "subscription",
      interval: "year",
      name: "Starter Annual",
      monthlyCredits: 800,
      priceCents: 9900,
      currency: "usd",
      stripePriceIds: {
        sandbox: "price_1TnHcy6B6kkgkutjwrbnyhHo",
        production: null,
      },
    },
    {
      id: "creator-annual",
      tier: "creator",
      billingType: "subscription",
      interval: "year",
      name: "Creator Annual",
      monthlyCredits: 2500,
      priceCents: 29900,
      currency: "usd",
      stripePriceIds: {
        sandbox: "price_1TnHcz6B6kkgkutj9MQEy6Sy",
        production: null,
      },
    },
    {
      id: "studio-annual",
      tier: "studio",
      billingType: "subscription",
      interval: "year",
      name: "Studio Annual",
      monthlyCredits: 6500,
      priceCents: 69900,
      currency: "usd",
      stripePriceIds: {
        sandbox: "price_1TnHd06B6kkgkutjDr8DoS5U",
        production: null,
      },
    },
  ],
} as const satisfies {
  defaultEnvironment: PricingEnvironment;
  environmentEnvKey: string;
  plans: readonly PricingPlanConfig[];
};
