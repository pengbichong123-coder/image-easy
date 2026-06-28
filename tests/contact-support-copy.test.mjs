import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const expectedSupportCopy = {
  de: { title: "Online-Support", forbidden: /Launch-Support/ },
  en: { title: "Online support", forbidden: /launch support/i },
  es: { title: "Soporte en línea", forbidden: /soporte de lanzamiento/i },
  fr: { title: "Support en ligne", forbidden: /support de lancement/i },
  it: { title: "Supporto online", forbidden: /supporto di lancio/i },
  ja: { title: "オンラインサポート", forbidden: /ローンチサポート/ },
  ko: { title: "온라인 지원", forbidden: /출시 지원/ },
  nl: { title: "Online support", forbidden: /lanceringssupport/i },
  zh: { title: "线上支持", forbidden: /上线支持/ },
};

function loadMessages(locale) {
  return JSON.parse(fs.readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
}

for (const [locale, expected] of Object.entries(expectedSupportCopy)) {
  test(`${locale} contact page uses online support wording`, () => {
    const contact = loadMessages(locale).trust.contact;

    assert.equal(contact.supportTitle, expected.title);
    assert.match(contact.supportBody, new RegExp(expected.title, "i"));
    assert.doesNotMatch(contact.supportBody, expected.forbidden);
  });
}
