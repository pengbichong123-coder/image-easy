import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("favicon assets are available and declared in metadata", () => {
  const favicon = new URL("../public/favicon.ico", import.meta.url);
  const layout = read("src/app/[locale]/layout.tsx");

  assert.ok(fs.existsSync(favicon), "public favicon.ico should exist");
  assert.ok(fs.statSync(favicon).size > 0, "favicon.ico should not be empty");
  assert.match(layout, /\/favicon\.ico/);
  assert.match(layout, /\/icon\.svg/);
});
