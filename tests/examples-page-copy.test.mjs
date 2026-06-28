import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const locales = ["en", "fr", "de", "es", "it", "nl", "zh", "ja", "ko"];

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function messages(locale) {
  return JSON.parse(read(`messages/${locale}.json`));
}

test("examples route, page, and gallery asset are wired", () => {
  assert.match(read("src/i18n/routing.ts"), /"\/examples":\s*"\/examples"/);
  assert.match(read("src/app/sitemap.ts"), /"\/examples"/);
  assert.ok(fs.existsSync(new URL("../src/app/[locale]/examples/page.tsx", import.meta.url)));
});

test("homepage shows proof images and links to examples", () => {
  const home = read("src/app/[locale]/page.tsx");

  assert.match(home, /FeaturedExamples/);
  assert.match(home, /UseCaseImageCard/);
  assert.match(home, /href="\/examples"/);
  assert.match(home, /item\.imageUrl/);
  assert.doesNotMatch(home, /ai-example-gallery\.png/);
});

for (const locale of locales) {
  test(`${locale} has examples copy`, () => {
    const data = messages(locale);

    assert.equal(typeof data.home.examplesTitle, "string");
    assert.equal(typeof data.home.examplesLead, "string");
    assert.equal(typeof data.home.examplesLink, "string");
    assert.equal(typeof data.examples.metaTitle, "string");
    assert.equal(typeof data.examples.title, "string");
    assert.equal(typeof data.examples.galleryTitle, "string");
    assert.ok(Array.isArray(data.examples.items));
    assert.equal(data.examples.items.length, 9);
    for (const item of data.examples.items) {
      assert.equal(typeof item.title, "string");
      assert.equal(typeof item.category, "string");
      assert.equal(typeof item.model, "string");
      assert.equal(typeof item.body, "string");
      assert.equal(typeof item.imageUrl, "string");
      assert.match(item.imageUrl, /^https:\/\/assets\.image-easy\.com\/site\/examples\/2026-06-29\/.+\.webp$/);
    }
    assert.equal(new Set(data.examples.items.map((item) => item.imageUrl)).size, 9);
  });
}
