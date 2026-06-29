import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const webhookSource = fs.readFileSync(
  new URL("../src/app/api/stripe/webhook/route.ts", import.meta.url),
  "utf8",
);

test("successful invoice events share the subscription credit grant path", () => {
  assert.match(webhookSource, /event\.type === "invoice\.paid"/);
  assert.match(webhookSource, /event\.type === "invoice\.payment_succeeded"/);
  assert.match(
    webhookSource,
    /invoice\.payment_succeeded"[\s\S]{0,240}processInvoicePaid\(tx, event\.data\.object as Stripe\.Invoice, event\.id\)/,
  );
});

test("subscription invoice grants use period credits without scheduling monthly grants", () => {
  assert.match(webhookSource, /getSubscriptionPlanPeriodCredits/);
  assert.match(webhookSource, /amount:\s*getSubscriptionPlanPeriodCredits\(input\.plan\)/);
  assert.doesNotMatch(webhookSource, /nextMonthlyCreditGrantAt/);
  assert.doesNotMatch(webhookSource, /nextGrantForPlan/);
});

test("subscription credit cron route is not registered", () => {
  const cronRouteExists = fs.existsSync(
    new URL("../src/app/api/cron/subscription-credits/route.ts", import.meta.url),
  );
  const vercelConfigUrl = new URL("../vercel.json", import.meta.url);
  const vercelConfig = fs.existsSync(vercelConfigUrl)
    ? fs.readFileSync(vercelConfigUrl, "utf8")
    : "";

  assert.equal(cronRouteExists, false);
  assert.doesNotMatch(vercelConfig, /subscription-credits/);
});
