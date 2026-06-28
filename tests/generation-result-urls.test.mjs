import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadGenerationResultsModule() {
  const source = fs.readFileSync(new URL("../src/lib/generation-results.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    console,
    exports: module.exports,
    module,
  });
  return module.exports;
}

test("result URL resolver prefers R2 asset keys over persisted provider URLs", async () => {
  const { resolveGenerationResultUrls } = loadGenerationResultsModule();

  const urls = await resolveGenerationResultUrls(
    {
      resultUrls: JSON.stringify(["https://provider.example/expired.png"]),
      resultAssetKeys: JSON.stringify(["generated/user/gen-0.png"]),
    },
    async (key) => `https://r2.example/${key}`,
  );

  assert.deepEqual(JSON.parse(JSON.stringify(urls)), ["https://r2.example/generated/user/gen-0.png"]);
});

test("result URL resolver falls back to provider URLs when no asset keys exist", async () => {
  const { resolveGenerationResultUrls } = loadGenerationResultsModule();

  const urls = await resolveGenerationResultUrls(
    {
      resultUrls: JSON.stringify(["https://provider.example/result.png"]),
      resultAssetKeys: null,
    },
    async (key) => `https://r2.example/${key}`,
  );

  assert.deepEqual(JSON.parse(JSON.stringify(urls)), ["https://provider.example/result.png"]);
});
