import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadSubscriptionPlansModule() {
  const source = fs.readFileSync(new URL("../src/lib/subscription-plans.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: module.exports,
    module,
  });
  return module.exports;
}

test("subscription plans expose three monthly and three annual tiers", () => {
  const { getSubscriptionPlans } = loadSubscriptionPlansModule();
  const plans = getSubscriptionPlans({
    STRIPE_PRICE_STARTER_MONTHLY: "price_starter_monthly",
    STRIPE_PRICE_CREATOR_MONTHLY: "price_creator_monthly",
    STRIPE_PRICE_STUDIO_MONTHLY: "price_studio_monthly",
    STRIPE_PRICE_STARTER_ANNUAL: "price_starter_annual",
    STRIPE_PRICE_CREATOR_ANNUAL: "price_creator_annual",
    STRIPE_PRICE_STUDIO_ANNUAL: "price_studio_annual",
  });
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

test("subscription plans can be found by Stripe price id", () => {
  const { findSubscriptionPlanByStripePriceId } = loadSubscriptionPlansModule();
  const plan = findSubscriptionPlanByStripePriceId("price_creator_annual", {
    STRIPE_PRICE_CREATOR_ANNUAL: "price_creator_annual",
  });

  assert.equal(plan.id, "creator-annual");
  assert.equal(plan.interval, "year");
  assert.equal(plan.monthlyCredits, 2500);
});
