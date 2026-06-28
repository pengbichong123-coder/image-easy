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

test("account menu fetches fresh account summary without refreshing the session provider", () => {
  assert.doesNotMatch(headerSource, /const \{ data: session, status, update \} = useSession\(\)/);
  assert.match(headerSource, /\/api\/account\/summary/);
});
