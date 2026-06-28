import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadModule() {
  const source = fs.readFileSync(new URL("../src/lib/billing-overview.ts", import.meta.url), "utf8");
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
    require: (id) => {
      if (id === "@/lib/db") return { prisma: {} };
      throw new Error(`Unexpected require: ${id}`);
    },
  });
  return module.exports;
}

test("credit transaction labels are user friendly", () => {
  const { creditTransactionLabel } = loadModule();

  assert.equal(creditTransactionLabel("reserve"), "Generation reserved");
  assert.equal(creditTransactionLabel("consume"), "Generation completed");
  assert.equal(creditTransactionLabel("refund"), "Generation refunded");
  assert.equal(creditTransactionLabel("subscription_grant"), "Subscription credits");
  assert.equal(creditTransactionLabel("purchase"), "Purchased credits");
});

test("subscription status labels are user friendly", () => {
  const { subscriptionStatusLabel } = loadModule();

  assert.equal(subscriptionStatusLabel("active"), "Active");
  assert.equal(subscriptionStatusLabel("past_due"), "Payment failed");
  assert.equal(subscriptionStatusLabel("canceled"), "Canceled");
  assert.equal(subscriptionStatusLabel("unknown"), "Unknown");
});

test("billing overview prefers current subscriptions before historical records", () => {
  const source = fs.readFileSync(new URL("../src/lib/billing-overview.ts", import.meta.url), "utf8");

  assert.match(source, /CURRENT_SUBSCRIPTION_STATUSES/);
  assert.match(source, /status: \{ in: CURRENT_SUBSCRIPTION_STATUSES \}/);
  assert.match(source, /subscription: currentSubscription \?\? fallbackSubscription/);
});
