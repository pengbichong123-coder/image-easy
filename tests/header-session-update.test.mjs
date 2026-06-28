import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const headerSource = fs.readFileSync(
  new URL("../src/components/Header.tsx", import.meta.url),
  "utf8",
);

test("account menu refreshes session outside the state updater", () => {
  assert.doesNotMatch(
    headerSource,
    /setMenuOpen\(\(open\)\s*=>\s*\{[\s\S]*?update\(\)/,
  );
});
