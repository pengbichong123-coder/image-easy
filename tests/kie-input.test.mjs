import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadKieModule() {
  const modelsSource = fs.readFileSync(new URL("../src/lib/models.ts", import.meta.url), "utf8");
  const kieSource = fs.readFileSync(new URL("../src/lib/kie.ts", import.meta.url), "utf8");
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  };
  const modelsOutput = ts.transpileModule(modelsSource, { compilerOptions }).outputText;
  const kieOutput = ts.transpileModule(kieSource, { compilerOptions }).outputText;
  const modelsModule = { exports: {} };
  vm.runInNewContext(modelsOutput, {
    exports: modelsModule.exports,
    module: modelsModule,
  });
  const kieModule = { exports: {} };
  vm.runInNewContext(kieOutput, {
    exports: kieModule.exports,
    module: kieModule,
    require: (id) => {
      if (id === "./models") return modelsModule.exports;
      throw new Error(`Unexpected require: ${id}`);
    },
    process,
    fetch,
    URL,
    AbortController,
    AbortSignal,
    setTimeout,
  });
  return kieModule.exports;
}

test("Kie input uses model-specific image URL field names", () => {
  const { buildKieInput } = loadKieModule();

  const gptInput = buildKieInput("gpt-image-2-image-to-image", {
    prompt: "make a clean product poster",
    imageUrls: ["https://example.com/input.png"],
  });
  assert.equal(gptInput.prompt, "make a clean product poster");
  assert.deepEqual(Array.from(gptInput.input_urls), ["https://example.com/input.png"]);
  assert.equal(gptInput.image_urls, undefined);

  const seedreamInput = buildKieInput("seedream-4-5-edit", {
    prompt: "make a clean product poster",
    imageUrls: ["https://example.com/input.png"],
  });
  assert.equal(seedreamInput.prompt, "make a clean product poster");
  assert.deepEqual(Array.from(seedreamInput.image_urls), ["https://example.com/input.png"]);
  assert.equal(seedreamInput.input_urls, undefined);

  const nanoInput = buildKieInput("nano-banana-pro", {
    prompt: "make a clean product poster",
    imageUrls: ["https://example.com/input.png"],
  });
  assert.equal(nanoInput.prompt, "make a clean product poster");
  assert.deepEqual(Array.from(nanoInput.image_input), ["https://example.com/input.png"]);
  assert.equal(nanoInput.image_urls, undefined);
});
