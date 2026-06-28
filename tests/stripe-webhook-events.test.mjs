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
