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

test("Stripe invoice grant keys are stable and invoice based", () => {
  const { buildStripeInvoiceGrantKey } = loadSubscriptionCreditGrantsModule();

  assert.equal(buildStripeInvoiceGrantKey("in_123"), "stripe_invoice:in_123");
});
