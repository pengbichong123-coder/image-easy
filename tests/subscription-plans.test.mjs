import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadSubscriptionPlansModule() {
  const pricingConfigSource = fs.readFileSync(new URL("../src/config/pricing.ts", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../src/lib/subscription-plans.ts", import.meta.url), "utf8");
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  };
  const pricingConfigOutput = ts.transpileModule(pricingConfigSource, { compilerOptions }).outputText;
  const { outputText } = ts.transpileModule(source, {
    compilerOptions,
  });
  const pricingConfigModule = { exports: {} };
  vm.runInNewContext(pricingConfigOutput, {
    exports: pricingConfigModule.exports,
    module: pricingConfigModule,
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: module.exports,
    module,
    require: (id) => {
      if (id === "@/config/pricing") return pricingConfigModule.exports;
      throw new Error(`Unexpected require: ${id}`);
    },
  });
  return module.exports;
}

test("subscription plans expose three monthly and three annual tiers", () => {
  const { getSubscriptionPlans } = loadSubscriptionPlansModule();
  const plans = getSubscriptionPlans({});
  const plainPlans = JSON.parse(JSON.stringify(plans));

  assert.deepEqual(
    plainPlans.map((plan) => plan.id),
    [
      "starter-monthly",
      "creator-monthly",
      "studio-monthly",
      "starter-annual",
      "creator-annual",
      "studio-annual",
    ],
  );
  assert.deepEqual(
    plainPlans.map((plan) => plan.monthlyCredits),
    [800, 2500, 6500, 800, 2500, 6500],
  );
  assert.deepEqual(
    plainPlans.map((plan) => plan.priceCents),
    [990, 2990, 6990, 9900, 29900, 69900],
  );
});

test("subscription plans use sandbox and production Stripe price ids separately", () => {
  const { getSubscriptionPlans } = loadSubscriptionPlansModule();

  const sandboxPlans = getSubscriptionPlans({
    STRIPE_PRICE_ENV: "sandbox",
  });
  const productionPlans = getSubscriptionPlans({
    STRIPE_PRICE_ENV: "production",
  });

  assert.equal(sandboxPlans.find((plan) => plan.id === "starter-monthly").pricingEnvironment, "sandbox");
  assert.equal(productionPlans.find((plan) => plan.id === "starter-monthly").pricingEnvironment, "production");
  assert.equal(sandboxPlans.find((plan) => plan.id === "starter-monthly").stripePriceId, "price_1TnHcw6B6kkgkutj66Pd9Izw");
  assert.equal(productionPlans.find((plan) => plan.id === "starter-monthly").stripePriceId, null);
});

test("subscription plan config carries tier, billing type, and interval details", () => {
  const { getSubscriptionPlans } = loadSubscriptionPlansModule();
  const [starter] = getSubscriptionPlans({});

  assert.equal(starter.tier, "starter");
  assert.equal(starter.billingType, "subscription");
  assert.equal(starter.interval, "month");
  assert.equal(starter.currency, "usd");
});

test("subscription plans can be found by configured sandbox Stripe price id", () => {
  const { findSubscriptionPlanByStripePriceId } = loadSubscriptionPlansModule();
  const plan = findSubscriptionPlanByStripePriceId("price_1TnHcz6B6kkgkutj9MQEy6Sy", {
    STRIPE_PRICE_ENV: "sandbox",
  });

  assert.equal(plan.id, "creator-annual");
  assert.equal(plan.interval, "year");
  assert.equal(plan.monthlyCredits, 2500);
});

test("production plans are hidden until live Stripe price ids are configured", () => {
  const { getConfiguredSubscriptionPlans } = loadSubscriptionPlansModule();

  assert.equal(getConfiguredSubscriptionPlans({ STRIPE_PRICE_ENV: "production" }).length, 0);
});
