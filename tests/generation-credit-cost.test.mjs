import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadCreditCostModule() {
  const modelsSource = fs.readFileSync(new URL("../src/lib/models.ts", import.meta.url), "utf8");
  const costSource = fs.readFileSync(new URL("../src/lib/generation-credit-cost.ts", import.meta.url), "utf8");
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  };
  const modelsOutput = ts.transpileModule(modelsSource, { compilerOptions }).outputText;
  const costOutput = ts.transpileModule(costSource, { compilerOptions }).outputText;
  const modelsModule = { exports: {} };
  vm.runInNewContext(modelsOutput, {
    exports: modelsModule.exports,
    module: modelsModule,
  });
  const costModule = { exports: {} };
  vm.runInNewContext(costOutput, {
    exports: costModule.exports,
    module: costModule,
    require: (id) => {
      if (id === "./models") return modelsModule.exports;
      throw new Error(`Unexpected require: ${id}`);
    },
  });
  return costModule.exports;
}

test("generation credit cost follows model and resolution rules", () => {
  const { getGenerationCreditCost } = loadCreditCostModule();

  assert.equal(getGenerationCreditCost({ model: "gpt-image-2-text-to-image", resolution: "1K" }), 3);
  assert.equal(getGenerationCreditCost({ model: "gpt-image-2-text-to-image", resolution: "2K" }), 5);
  assert.equal(getGenerationCreditCost({ model: "gpt-image-2-text-to-image", resolution: "4K" }), 8);
  assert.equal(getGenerationCreditCost({ model: "gpt-image-2-image-to-image", resolution: "4K" }), 8);
  assert.equal(getGenerationCreditCost({ model: "seedream-4-5-text-to-image" }), 7);
  assert.equal(getGenerationCreditCost({ model: "seedream-4-5-edit", quality: "high" }), 7);
  assert.equal(getGenerationCreditCost({ model: "nano-banana-pro", resolution: "1K" }), 8);
  assert.equal(getGenerationCreditCost({ model: "nano-banana-pro", resolution: "2K" }), 8);
  assert.equal(getGenerationCreditCost({ model: "nano-banana-pro", resolution: "4K" }), 14);
});

test("generation records are priced from their persisted params", () => {
  const { getGenerationCreditCostForRecord } = loadCreditCostModule();

  assert.equal(
    getGenerationCreditCostForRecord({
      model: "gpt-image-2-text-to-image",
      resolution: "2K",
      quality: null,
      aspectRatio: "1:1",
      outputFormat: null,
    }),
    5,
  );
  assert.equal(
    getGenerationCreditCostForRecord({
      model: "seedream-4-5-edit",
      resolution: null,
      quality: "basic",
      aspectRatio: "1:1",
      outputFormat: null,
    }),
    7,
  );
});
