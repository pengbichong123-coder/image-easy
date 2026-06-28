import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadModelsModule() {
  const source = fs.readFileSync(new URL("../src/lib/models.ts", import.meta.url), "utf8");
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

test("model groups merge multiple capabilities under one model", () => {
  const { MODEL_GROUPS } = loadModelsModule();
  const groups = JSON.parse(JSON.stringify(MODEL_GROUPS));

  assert.deepEqual(
    groups.map((group) => group.slug),
    ["gpt-image-2", "seedream-4-5", "nano-banana-pro"],
  );
  assert.deepEqual(
    groups.find((group) => group.slug === "gpt-image-2").capabilities.map((item) => item.capability),
    ["text-to-image", "image-to-image"],
  );
  assert.deepEqual(
    groups.find((group) => group.slug === "seedream-4-5").capabilities.map((item) => item.capability),
    ["text-to-image", "image-to-image"],
  );
  assert.deepEqual(
    groups.find((group) => group.slug === "nano-banana-pro").capabilities.map((item) => item.capability),
    ["image-to-image"],
  );
});

test("models keep stable app ids separate from Kie model names", () => {
  const { MODELS } = loadModelsModule();

  assert.equal(MODELS["seedream-4-5-text-to-image"].kieModel, "seedream/4.5-text-to-image");
  assert.equal(MODELS["seedream-4-5-edit"].kieModel, "seedream/4.5-edit");

  for (const model of Object.values(MODELS)) {
    assert.equal(typeof model.id, "string");
    assert.equal(typeof model.kieModel, "string");
    assert.ok(model.kieModel.length > 0);
  }
});

test("model params are normalized with required defaults for the selected model", () => {
  const { normalizeModelParams } = loadModelsModule();

  const restoredDefaults = normalizeModelParams("seedream-4-5-text-to-image", {
    aspectRatio: "1:1",
    resolution: undefined,
    quality: undefined,
    outputFormat: undefined,
  });

  assert.equal(restoredDefaults.aspectRatio, "1:1");
  assert.equal(restoredDefaults.resolution, undefined);
  assert.equal(restoredDefaults.quality, "basic");
  assert.equal(restoredDefaults.outputFormat, undefined);

  const clearedUnsupportedParams = normalizeModelParams("seedream-4-5-text-to-image", {
    aspectRatio: "auto",
    resolution: "4K",
    quality: "high",
    outputFormat: "png",
  });

  assert.equal(clearedUnsupportedParams.aspectRatio, "1:1");
  assert.equal(clearedUnsupportedParams.resolution, undefined);
  assert.equal(clearedUnsupportedParams.quality, "high");
  assert.equal(clearedUnsupportedParams.outputFormat, undefined);
});
