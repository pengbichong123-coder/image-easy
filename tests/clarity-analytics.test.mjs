import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Microsoft Clarity is wired through a public project id", () => {
  const component = read("src/components/MicrosoftClarity.tsx");
  const layout = read("src/app/[locale]/layout.tsx");
  const envExample = read(".env.example");

  assert.match(component, /NEXT_PUBLIC_CLARITY_PROJECT_ID/);
  assert.match(component, /https:\/\/www\.clarity\.ms\/tag\//);
  assert.match(component, /return null/);
  assert.match(layout, /<MicrosoftClarity \/>/);
  assert.match(envExample, /NEXT_PUBLIC_CLARITY_PROJECT_ID=/);
});
