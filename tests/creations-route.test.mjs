import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function exists(path) {
  return fs.existsSync(new URL(`../${path}`, import.meta.url));
}

test("creations is the canonical signed-in gallery route", () => {
  const routing = read("src/i18n/routing.ts");
  const header = read("src/components/Header.tsx");
  const home = read("src/app/[locale]/page.tsx");
  const metadata = read("src/lib/page-metadata.ts");
  const content = read("src/app/[locale]/creations/creations-content.tsx");

  assert.match(routing, /"\/creations": "\/creations"/);
  assert.match(header, /href="\/creations"/);
  assert.match(home, /href="\/creations"/);
  assert.match(metadata, /creations: "archive"/);
  assert.match(content, /callbackUrl=\/creations/);
});

test("my-images route is not kept before launch", () => {
  const routing = read("src/i18n/routing.ts");
  const creationsPage = read("src/app/[locale]/creations/page.tsx");

  assert.equal(exists("src/app/[locale]/my-images/page.tsx"), false);
  assert.equal(exists("src/app/[locale]/my-images/my-images-content.tsx"), false);
  assert.doesNotMatch(routing, /my-images/);
  assert.match(creationsPage, /CreationsContent/);
  assert.match(creationsPage, /page: "creations"/);
});
