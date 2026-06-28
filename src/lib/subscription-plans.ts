import { PRICING_CONFIG, type PricingBillingType, type PricingEnvironment } from "@/config/pricing";

export type SubscriptionPlanTier = "starter" | "creator" | "studio";
export type SubscriptionPlanInterval = "month" | "year";

export type SubscriptionPlan = {
  id: string;
  tier: SubscriptionPlanTier;
  billingType: PricingBillingType;
  interval: SubscriptionPlanInterval;
  name: string;
  monthlyCredits: number;
  priceCents: number;
  currency: string;
  stripePriceId: string | null;
  pricingEnvironment: PricingEnvironment;
};

type PriceEnv = Record<string, string | undefined>;

export function resolvePricingEnvironment(env: PriceEnv = process.env): PricingEnvironment {
  const configured = env[PRICING_CONFIG.environmentEnvKey]?.trim().toLowerCase();
  if (configured === "production" || configured === "sandbox") return configured;
  if (env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) return "production";
  return PRICING_CONFIG.defaultEnvironment;
}

export function getSubscriptionPlans(env: PriceEnv = process.env): SubscriptionPlan[] {
  const pricingEnvironment = resolvePricingEnvironment(env);

  return PRICING_CONFIG.plans.map((plan) => ({
    id: plan.id,
    tier: plan.tier,
    billingType: plan.billingType,
    interval: plan.interval,
    name: plan.name,
    monthlyCredits: plan.monthlyCredits,
    priceCents: plan.priceCents,
    currency: plan.currency,
    stripePriceId: plan.stripePriceIds[pricingEnvironment],
    pricingEnvironment,
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
