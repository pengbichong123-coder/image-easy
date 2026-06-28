import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadHistoryStatusRefreshModule() {
  const source = fs.readFileSync(new URL("../src/lib/history-status-refresh.ts", import.meta.url), "utf8");
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

test("pending and processing history items need one status refresh", () => {
  const { getHistoryItemsNeedingStatusRefresh } = loadHistoryStatusRefreshModule();
  const items = [
    { id: "gen_done", status: "completed" },
    { id: "gen_failed", status: "failed" },
    { id: "gen_pending", status: "pending" },
    { id: "gen_processing", status: "processing" },
  ];

  assert.deepEqual(getHistoryItemsNeedingStatusRefresh(items), ["gen_pending", "gen_processing"]);
});

test("status refresh result is merged into the matching history item", () => {
  const { mergeHistoryItemStatusRefresh } = loadHistoryStatusRefreshModule();
  const items = [
    { id: "gen_1", status: "processing", resultUrls: [], prompt: "old" },
    { id: "gen_2", status: "completed", resultUrls: ["existing"], prompt: "keep" },
  ];

  const mergedItems = mergeHistoryItemStatusRefresh(items, {
      id: "gen_1",
      status: "completed",
      resultUrls: ["new-image"],
      errorMessage: null,
    });

  assert.deepEqual(
    JSON.parse(JSON.stringify(mergedItems)),
    [
      { id: "gen_1", status: "completed", resultUrls: ["new-image"], prompt: "old", errorMessage: null },
      { id: "gen_2", status: "completed", resultUrls: ["existing"], prompt: "keep" },
    ],
  );
});
