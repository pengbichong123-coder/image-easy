import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadPricingModeModule() {
  const source = fs.readFileSync(new URL("../src/lib/pricing-mode.ts", import.meta.url), "utf8");
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

test("paid credits are disabled unless explicitly enabled", () => {
  const { isPaidCreditsEnabled } = loadPricingModeModule();

  assert.equal(isPaidCreditsEnabled(undefined), false);
  assert.equal(isPaidCreditsEnabled(""), false);
  assert.equal(isPaidCreditsEnabled("false"), false);
  assert.equal(isPaidCreditsEnabled("TRUE"), true);
});
