import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const locales = ["en", "fr", "de", "es", "it", "nl", "zh", "ja", "ko"];

const requiredSections = {
  privacy: [
    "account",
    "content",
    "providers",
    "payments",
    "security",
    "retention",
    "rights",
    "children",
    "changes",
    "contact",
  ],
  terms: [
    "eligibility",
    "account",
    "credits",
    "priceChanges",
    "contentRights",
    "prohibited",
    "aiOutputs",
    "subscriptions",
    "termination",
    "disclaimers",
    "liability",
    "changes",
    "contact",
  ],
  legal: [
    "operator",
    "ip",
    "copyright",
    "thirdParty",
    "lawRequests",
    "contact",
  ],
};

function loadMessages(locale) {
  return JSON.parse(fs.readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
}

test("legal route and footer link are wired", () => {
  const routing = fs.readFileSync(new URL("../src/i18n/routing.ts", import.meta.url), "utf8");
  const footer = fs.readFileSync(new URL("../src/components/SiteFooter.tsx", import.meta.url), "utf8");

  assert.match(routing, /"\/legal":\s*"\/legal"/);
  assert.ok(fs.existsSync(new URL("../src/app/[locale]/legal/page.tsx", import.meta.url)));
  assert.match(footer, /href="\/legal"/);
});

for (const locale of locales) {
  test(`${locale} has complete commercial legal copy`, () => {
    const trust = loadMessages(locale).trust;

    for (const page of ["privacy", "terms", "legal"]) {
      assert.equal(typeof trust[page].metaTitle, "string");
      assert.equal(typeof trust[page].lead, "string");
      assert.equal(typeof trust[page].notice, "string");

      for (const section of requiredSections[page]) {
        assert.equal(typeof trust[page][`${section}Title`], "string", `${page}.${section}Title`);
        assert.equal(typeof trust[page][`${section}Body`], "string", `${page}.${section}Body`);
      }
    }

    const commercialTerms = `${trust.terms.creditsBody} ${trust.terms.priceChangesBody} ${trust.terms.subscriptionsBody}`;
    assert.match(
      commercialTerms,
      /credit|price|cost|subscription|crédit|prix|kosten|preis|precio|costo|crediti|prezzo|prijs|积分|价格|费用|クレジット|価格|크레딧|가격/i,
    );
  });
}
