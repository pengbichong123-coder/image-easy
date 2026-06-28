import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("English archive copy uses Creations wording", () => {
  const en = JSON.parse(fs.readFileSync(new URL("../messages/en.json", import.meta.url), "utf8"));

  assert.equal(en.nav.archive, "Creations");
  assert.equal(en.home.footerArchive, "Creations");
  assert.equal(en.archive.kicker, "Creations");
  assert.equal(en.archive.titleEm, "creations");
  assert.match(en.archive.emptyText, /creations/i);
  assert.match(en.archive.printCount, /creation/i);
});

test("Chinese archive copy uses works wording", () => {
  const zh = JSON.parse(fs.readFileSync(new URL("../messages/zh.json", import.meta.url), "utf8"));

  assert.equal(zh.nav.archive, "我的作品");
  assert.equal(zh.home.footerArchive, "我的作品");
  assert.equal(zh.archive.kicker, "我的作品");
  assert.equal(zh.archive.titleEm, "作品");
});

test("credit transaction table renders timestamps with seconds", () => {
  const source = fs.readFileSync(
    new URL("../src/app/[locale]/billing/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /function formatDateTime/);
  assert.match(source, /timeStyle: "medium"/);
  assert.match(source, /formatDateTime\(item\.createdAt, locale\)/);
});
