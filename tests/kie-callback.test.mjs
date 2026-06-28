import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadCallbackModule() {
  const source = fs.readFileSync(new URL("../src/lib/kie-callback.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    URL,
    exports: module.exports,
    module,
  });
  return module.exports;
}

test("Kie callback is disabled for local development URLs", () => {
  const { buildKieCallbackUrl, shouldUseKieCallback } = loadCallbackModule();

  assert.equal(shouldUseKieCallback("http://localhost:3000", "secret"), false);
  assert.equal(shouldUseKieCallback("http://127.0.0.1:3000", "secret"), false);
  assert.equal(buildKieCallbackUrl("gen_1", "http://localhost:3000", "secret"), undefined);
});

test("Kie callback requires a public HTTPS app URL and callback secret", () => {
  const { buildKieCallbackUrl, shouldUseKieCallback } = loadCallbackModule();

  assert.equal(shouldUseKieCallback("https://www.image-easy.com", ""), false);
  assert.equal(shouldUseKieCallback("http://www.image-easy.com", "secret"), false);
  assert.equal(shouldUseKieCallback("https://www.image-easy.com", "secret"), true);

  const callbackUrl = buildKieCallbackUrl("gen_123", "https://www.image-easy.com/", "secret value");
  assert.equal(
    callbackUrl,
    "https://www.image-easy.com/api/kie/callback?generationId=gen_123&token=secret+value",
  );
});
