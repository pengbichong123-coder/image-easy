import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadSubscriptionCreditGrantsModule() {
  const source = fs.readFileSync(new URL("../src/lib/subscription-credit-grants.ts", import.meta.url), "utf8");
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

test("annual subscriptions schedule the next monthly credit grant", () => {
  const { nextMonthlyCreditGrantAt } = loadSubscriptionCreditGrantsModule();

  assert.equal(
    nextMonthlyCreditGrantAt(new Date("2026-01-31T12:00:00.000Z")).toISOString(),
    "2026-02-28T12:00:00.000Z",
  );
  assert.equal(
    nextMonthlyCreditGrantAt(new Date("2026-02-28T12:00:00.000Z")).toISOString(),
    "2026-03-28T12:00:00.000Z",
  );
});

test("monthly grant keys are stable and date based", () => {
  const { buildMonthlySubscriptionGrantKey } = loadSubscriptionCreditGrantsModule();

  assert.equal(
    buildMonthlySubscriptionGrantKey("sub_123", new Date("2026-06-28T15:43:19.000Z")),
    "subscription_monthly:sub_123:2026-06-28",
  );
});
