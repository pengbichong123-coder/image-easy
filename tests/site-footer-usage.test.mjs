import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const fullFooterPages = [
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/about/page.tsx",
  "src/app/[locale]/contact/page.tsx",
  "src/app/[locale]/pricing/page.tsx",
  "src/app/[locale]/privacy/page.tsx",
  "src/app/[locale]/terms/page.tsx",
  "src/app/[locale]/legal/page.tsx",
];

test("public pages use the shared full site footer", () => {
  const footer = read("src/components/SiteFooter.tsx");

  assert.match(footer, /variant\?:\s*"full"\s*\|\s*"compact"/);
  assert.match(footer, /footerAtelier/);
  assert.match(footer, /footerPrivacyPolicy/);
  assert.match(footer, /href="\/legal"/);

  for (const page of fullFooterPages) {
    const source = read(page);
    assert.match(source, /SiteFooter/);
    assert.match(source, /variant="full"/);
  }
});

test("login page uses compact legal footer while workspace pages stay focused", () => {
  const login = read("src/app/[locale]/login/page.tsx");
  const create = read("src/app/[locale]/create/page.tsx");
  const creations = read("src/app/[locale]/creations/page.tsx");

  assert.match(login, /SiteFooter/);
  assert.match(login, /variant="compact"/);
  assert.doesNotMatch(create, /SiteFooter/);
  assert.doesNotMatch(creations, /SiteFooter/);
});
