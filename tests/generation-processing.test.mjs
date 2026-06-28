import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadGenerationProcessingModule() {
  const source = fs.readFileSync(new URL("../src/lib/generation-processing.ts", import.meta.url), "utf8");
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
    require: (specifier) => {
      if (specifier === "node:crypto") return { randomUUID: () => "test-attempt" };
      return {};
    },
    console,
    Date,
  });
  return module.exports;
}

test("failed generation updates are allowed when no storage lock exists", () => {
  const { canMarkGenerationFailedWithStorageState } = loadGenerationProcessingModule();

  assert.equal(
    canMarkGenerationFailedWithStorageState({
      storageStatus: null,
      storageStartedAt: null,
      staleStorageStartedBefore: new Date("2026-01-01T00:00:00.000Z"),
    }),
    true,
  );
});

test("failed generation updates do not steal a fresh storage lock", () => {
  const { canMarkGenerationFailedWithStorageState } = loadGenerationProcessingModule();

  assert.equal(
    canMarkGenerationFailedWithStorageState({
      storageStatus: "processing",
      storageStartedAt: new Date("2026-01-01T00:05:00.000Z"),
      staleStorageStartedBefore: new Date("2026-01-01T00:00:00.000Z"),
    }),
    false,
  );
});

test("failed generation updates can recover a stale storage lock", () => {
  const { canMarkGenerationFailedWithStorageState } = loadGenerationProcessingModule();

  assert.equal(
    canMarkGenerationFailedWithStorageState({
      storageStatus: "processing",
      storageStartedAt: new Date("2025-12-31T23:59:00.000Z"),
      staleStorageStartedBefore: new Date("2026-01-01T00:00:00.000Z"),
    }),
    true,
  );
});
