import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadModule() {
  const source = fs.readFileSync(new URL("../src/lib/billing-events.ts", import.meta.url), "utf8");
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

test("billing event labels are stable", () => {
  const { billingEventLabel } = loadModule();

  assert.equal(billingEventLabel("invoice_paid"), "Invoice paid");
  assert.equal(billingEventLabel("invoice_payment_failed"), "Payment failed");
  assert.equal(billingEventLabel("refund_created"), "Refund recorded");
  assert.equal(billingEventLabel("unknown_type"), "Billing event");
});

test("billing event status priority surfaces failed payments first", () => {
  const { mostImportantBillingStatus } = loadModule();

  assert.equal(mostImportantBillingStatus(["paid", "failed"]), "failed");
  assert.equal(mostImportantBillingStatus(["paid", "refunded"]), "refunded");
  assert.equal(mostImportantBillingStatus(["paid"]), "paid");
});
