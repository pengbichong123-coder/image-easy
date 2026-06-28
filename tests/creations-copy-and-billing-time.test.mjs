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

test("home signup credit headline reads naturally in English and Chinese", () => {
  const en = JSON.parse(fs.readFileSync(new URL("../messages/en.json", import.meta.url), "utf8"));
  const zh = JSON.parse(fs.readFileSync(new URL("../messages/zh.json", import.meta.url), "utf8"));

  assert.equal(en.home.title, "Five AI image models in one workspace.");
  assert.equal(en.home.modelCompareTitle, "Choose the model for the job.");
  assert.equal(en.home.section2Title, "Three steps. One workflow.");
  assert.equal(en.home.limitedTitle, "Start with free credits. Upgrade when you need more.");
  assert.equal(en.home.section3Title, "Ready to generate?");

  assert.equal(zh.home.title, "五款 AI 图像模型，一个工作台。");
  assert.equal(zh.home.modelCompareTitle, "按任务选择模型。");
  assert.equal(zh.home.section2Title, "三步，一个流程。");
  assert.equal(zh.home.limitedTitle, "免费积分开局，按需升级套餐。");
  assert.equal(zh.home.section3Title, "准备好生成了吗？");
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

test("home limited credit headline is rendered as one complete sentence", () => {
  const source = fs.readFileSync(new URL("../src/app/[locale]/page.tsx", import.meta.url), "utf8");

  assert.ok(source.includes('t("title")'));
  assert.ok(source.includes('t("modelCompareTitle")'));
  assert.ok(source.includes('t("section2Title")'));
  assert.ok(source.includes('t("limitedTitle")'));
  assert.ok(source.includes('t("section3Title")'));
  assert.ok(!source.includes("TitleA"));
  assert.ok(!source.includes("TitleEm"));
  assert.ok(!source.includes("TitleB"));
});
