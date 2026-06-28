export type SubscriptionPlanTier = "starter" | "creator" | "studio";
export type SubscriptionPlanInterval = "month" | "year";

export type SubscriptionPlan = {
  id: string;
  tier: SubscriptionPlanTier;
  interval: SubscriptionPlanInterval;
  name: string;
  monthlyCredits: number;
  priceCents: number;
  currency: string;
  stripePriceId: string | null;
};

type PriceEnv = Record<string, string | undefined>;

const PLAN_DEFINITIONS = [
  {
    id: "starter-monthly",
    tier: "starter",
    interval: "month",
    name: "Starter",
    monthlyCredits: 800,
    priceCents: 990,
    envKey: "STRIPE_PRICE_STARTER_MONTHLY",
  },
  {
    id: "creator-monthly",
    tier: "creator",
    interval: "month",
    name: "Creator",
    monthlyCredits: 2500,
    priceCents: 2990,
    envKey: "STRIPE_PRICE_CREATOR_MONTHLY",
  },
  {
    id: "studio-monthly",
    tier: "studio",
    interval: "month",
    name: "Studio",
    monthlyCredits: 6500,
    priceCents: 6990,
    envKey: "STRIPE_PRICE_STUDIO_MONTHLY",
  },
  {
    id: "starter-annual",
    tier: "starter",
    interval: "year",
    name: "Starter Annual",
    monthlyCredits: 800,
    priceCents: 9900,
    envKey: "STRIPE_PRICE_STARTER_ANNUAL",
  },
  {
    id: "creator-annual",
    tier: "creator",
    interval: "year",
    name: "Creator Annual",
    monthlyCredits: 2500,
    priceCents: 29900,
    envKey: "STRIPE_PRICE_CREATOR_ANNUAL",
  },
  {
    id: "studio-annual",
    tier: "studio",
    interval: "year",
    name: "Studio Annual",
    monthlyCredits: 6500,
    priceCents: 69900,
    envKey: "STRIPE_PRICE_STUDIO_ANNUAL",
  },
] as const;

export function getSubscriptionPlans(env: PriceEnv = process.env): SubscriptionPlan[] {
  return PLAN_DEFINITIONS.map((plan) => ({
    id: plan.id,
    tier: plan.tier,
    interval: plan.interval,
    name: plan.name,
    monthlyCredits: plan.monthlyCredits,
    priceCents: plan.priceCents,
    currency: "usd",
    stripePriceId: env[plan.envKey]?.trim() || null,
  }));
}

export function getConfiguredSubscriptionPlans(env: PriceEnv = process.env) {
  return getSubscriptionPlans(env).filter((plan) => Boolean(plan.stripePriceId));
}

export function findSubscriptionPlanById(planId: string, env: PriceEnv = process.env) {
  const plan = getSubscriptionPlans(env).find((item) => item.id === planId);
  if (!plan) {
    throw new Error(`Unknown subscription plan: ${planId}`);
  }
  return plan;
}

export function findSubscriptionPlanByStripePriceId(priceId: string, env: PriceEnv = process.env) {
  const plan = getConfiguredSubscriptionPlans(env).find((item) => item.stripePriceId === priceId);
  if (!plan) {
    throw new Error(`Unknown Stripe subscription price: ${priceId}`);
  }
  return plan;
}
