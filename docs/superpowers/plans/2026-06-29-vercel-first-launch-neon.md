# Vercel First Launch With Neon Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans if executing this runbook in Codex. This is a deployment runbook, not a feature implementation plan.

**Goal:** Deploy Image Easy to Vercel for the first time using the already-created Neon PostgreSQL database, with schema initialized before traffic reaches production.

**Architecture:** Vercel runs the Next.js 15 app and scheduled cron endpoint. Neon stores Auth.js, user, generation, billing, credit, upload, and asset records. Cloudflare R2 stores uploaded/generated assets and public marketing images; Kie handles image generation; Stripe can remain disabled for first launch unless production Prices are ready.

**Tech Stack:** Next.js 15 App Router, React 19 RC, next-intl, Auth.js/NextAuth v5, Prisma 5, Neon PostgreSQL, Cloudflare R2, Kie API, Stripe Checkout/webhooks, Vercel Cron.

---

## Current Project Findings

- `package.json` uses `npm run build`, `npm run lint`, `npm run db:push`, and `postinstall` runs `prisma generate`.
- `prisma/schema.prisma` uses PostgreSQL via `DATABASE_URL` and contains all required launch tables, including Auth.js tables, `Generation`, `Asset`, `CreditTransaction`, `UserSubscription`, `BillingEvent`, and `StripeWebhookEvent`.
- There is no migration history folder. Current production initialization should use `npx prisma db push` / `npm run db:push`.
- `vercel.json` already defines one cron job: `/api/cron/subscription-credits` at `0 0 * * *`.
- Paid checkout is guarded by `ENABLE_PAID_CREDITS`. Leave it `false` for first launch unless production Stripe Price IDs are added in `src/config/pricing.ts`.
- Public example images now use `https://assets.image-easy.com`; user uploads/generated outputs continue to use R2 signed URLs for private-ish access.

## Deployment Decision

First production launch should be a **free-credit beta launch**:

- Set `ENABLE_PAID_CREDITS=false`.
- Keep `STRIPE_PRICE_ENV=sandbox` or omit paid checkout entirely in production env until live Stripe Price IDs are configured.
- Configure Stripe webhook only if you plan to test sandbox payments on production. Otherwise, do not expose paid checkout yet.

Reason: `src/config/pricing.ts` currently has sandbox Price IDs but `production: null` for every subscription plan.

## Phase 1: Freeze And Verify Local Build

1. Confirm the worktree state and avoid accidental unrelated changes:

```bash
git status --short
```

Expected:

- Known pending launch changes only.
- No accidental local secrets committed.

2. Run local checks:

```bash
npm run lint
npm run build
node --test tests/examples-page-copy.test.mjs
node --test tests/legal-pages-copy.test.mjs
node --test tests/site-footer-usage.test.mjs
node --test tests/contact-support-copy.test.mjs
```

Expected:

- TypeScript passes.
- Next production build completes.
- Route list includes `/[locale]`, `/[locale]/create`, `/[locale]/examples`, `/[locale]/pricing`, `/[locale]/privacy`, `/[locale]/terms`, `/[locale]/legal`, `/[locale]/contact`, `/[locale]/about`, and `/[locale]/billing`.

## Phase 2: Prepare Neon Connection Strings

From Neon Console, copy both:

- Pooled connection string: use for Vercel runtime `DATABASE_URL`.
- Direct connection string: use locally for the one-time Prisma schema initialization.

Recommended naming:

```text
DATABASE_URL=<Neon pooled connection string>
DATABASE_URL_DIRECT=<Neon direct connection string, local shell only>
```

Do not commit either value.

## Phase 3: Initialize Neon Schema

Because the Neon database exists but has no schema/data, initialize it before the first Vercel production deployment receives traffic.

1. From your local machine, use the **direct Neon connection string** for schema push:

```bash
DATABASE_URL='<NEON_DIRECT_CONNECTION_STRING>' npx prisma db push
```

Expected:

- Prisma creates all tables from `prisma/schema.prisma`.
- No data is required for a free-credit beta launch; users are created by Google sign-in.

2. Verify tables exist:

```bash
DATABASE_URL='<NEON_DIRECT_CONNECTION_STRING>' npx prisma db pull --print
```

Expected:

- Output includes `User`, `Account`, `Session`, `Generation`, `Asset`, `CreditTransaction`, `UserSubscription`, `BillingEvent`, and `StripeWebhookEvent`.

3. Optional safe smoke query from Neon SQL editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected:

- Prisma model tables are present.

## Phase 4: Configure Vercel Project

1. Import the GitHub repo into Vercel.

2. Use defaults:

```text
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: .next
Node.js Version: 22.x if available, otherwise 20.x
Production Branch: main
```

3. Add the production domain:

```text
www.image-easy.com
image-easy.com
```

Use whichever one you want as canonical. Current code and `.env.local` expect:

```text
https://www.image-easy.com
```

## Phase 5: Configure Vercel Production Environment Variables

Set these in Vercel Project Settings → Environment Variables → Production.

### Required Core

```text
DATABASE_URL=<NEON_POOLED_CONNECTION_STRING>
AUTH_SECRET=<new 32+ char random secret>
AUTH_URL=https://www.image-easy.com
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL=https://www.image-easy.com
NEXT_PUBLIC_SITE_URL=https://www.image-easy.com
```

Generate `AUTH_SECRET` locally:

```bash
openssl rand -base64 32
```

### Google OAuth

```text
AUTH_GOOGLE_ID=<production Google OAuth client id>
AUTH_GOOGLE_SECRET=<production Google OAuth client secret>
```

Google OAuth Console must include:

```text
Authorized JavaScript origins:
https://www.image-easy.com

Authorized redirect URIs:
https://www.image-easy.com/api/auth/callback/google
```

### Kie

```text
KIE_API_KEY=<production Kie key>
KIE_API_BASE=https://api.kie.ai
KIE_CALLBACK_SECRET=<new random callback token>
```

Generate `KIE_CALLBACK_SECRET` locally:

```bash
openssl rand -hex 32
```

With `NEXT_PUBLIC_APP_URL=https://www.image-easy.com` and `KIE_CALLBACK_SECRET` set, the app will send Kie callback URLs like:

```text
https://www.image-easy.com/api/kie/callback?generationId=...&token=...
```

### Cloudflare R2

```text
R2_ACCOUNT_ID=<Cloudflare account id>
R2_ACCESS_KEY_ID=<R2 access key id>
R2_SECRET_ACCESS_KEY=<R2 secret access key>
R2_BUCKET_NAME=image-easy-assets
R2_PUBLIC_BASE_URL=https://assets.image-easy.com
R2_SIGNED_URL_TTL_SECONDS=3600
```

Expected:

- Public marketing assets load from `https://assets.image-easy.com/site/examples/...`.
- User generated assets can still be served through signed R2 URLs.

### Stripe / Billing

For first launch without paid checkout:

```text
ENABLE_PAID_CREDITS=false
STRIPE_PRICE_ENV=sandbox
STRIPE_SECRET_KEY=<sandbox key if you want internal checkout tests, otherwise leave unset only if no paid routes are called>
STRIPE_WEBHOOK_SECRET=<sandbox webhook secret if testing, otherwise leave unset only if no webhook route is used>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<sandbox publishable key if testing, otherwise optional>
CRON_SECRET=<new random cron secret>
```

Generate `CRON_SECRET` locally:

```bash
openssl rand -hex 32
```

Before enabling real payments later:

- Create live Stripe subscription Prices.
- Fill the `production` values in `src/config/pricing.ts`.
- Set `STRIPE_PRICE_ENV=production`.
- Set `ENABLE_PAID_CREDITS=true`.
- Configure Stripe live webhook endpoint.

### Analytics

```text
NEXT_PUBLIC_GA_MEASUREMENT_ID=<GA4 measurement id, optional>
```

If empty, the app should not inject GA.

## Phase 6: Deploy First Production Build

1. Trigger a Vercel production deploy from `main`.

2. Watch build logs for:

```text
prisma generate
npm run build
Generating static pages
Finalizing page optimization
```

Expected:

- Build succeeds.
- `vercel.json` registers `/api/cron/subscription-credits`.

3. If build fails because of missing env vars, fix Vercel env and redeploy. Vercel env changes apply only to new deployments.

## Phase 7: Configure External Webhooks After Domain Works

Only do this after `https://www.image-easy.com` resolves and Vercel deployment is live.

### Stripe webhook

If using Stripe sandbox on production:

```text
Endpoint URL:
https://www.image-easy.com/api/stripe/webhook
```

Subscribe to at least:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
invoice.paid
invoice.payment_succeeded
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
charge.refunded
refund.created
```

Copy the endpoint signing secret into:

```text
STRIPE_WEBHOOK_SECRET=<whsec_...>
```

Then redeploy.

### Kie callback

No dashboard callback configuration is required if this app sends the callback URL per task. Verify Vercel logs show `POST /api/kie/callback` after a generation completes.

## Phase 8: Production Smoke Tests

Run in this order.

1. Public pages:

```bash
curl -I https://www.image-easy.com/en
curl -I https://www.image-easy.com/en/examples
curl -I https://www.image-easy.com/en/privacy
curl -I https://www.image-easy.com/sitemap.xml
curl -I https://assets.image-easy.com/site/examples/2026-06-29/minimal-skincare-product-scene.webp
```

Expected:

- `200` for all.
- R2 image returns `content-type: image/webp`.

2. Google login:

- Open `https://www.image-easy.com/en/login`.
- Sign in with Google.
- Confirm a new user row appears in Neon.
- Confirm the user starts with 10 credits.

3. Image generation:

- Sign in.
- Open `/en/create`.
- Generate one low-cost text-to-image result.
- Confirm:
  - credits reserve/consume records are created in `CreditTransaction`;
  - `Generation.status` becomes `completed`;
  - `Generation.resultAssetKeys` contains R2 keys;
  - R2 contains `users/<userId>/generated/...`.

4. History:

- Open `/en/creations`.
- Confirm the generated image appears.
- Confirm delete removes the generation and deletes related R2 objects.

5. Kie callback:

- Check Vercel function logs for `/api/kie/callback`.
- If callbacks do not appear, polling should still work through `/api/generate/[id]`, but callback reliability should be fixed before scale.

6. Cron:

Manual test:

```bash
curl -i \
  -H "Authorization: Bearer <CRON_SECRET>" \
  https://www.image-easy.com/api/cron/subscription-credits
```

Expected:

- `200`.
- JSON like `{"checked":0,"granted":0,"skipped":0}` before annual subscriptions exist.

## Phase 9: SEO And Measurement

1. Google Search Console:

```text
Verify: https://www.image-easy.com
Submit: https://www.image-easy.com/sitemap.xml
Inspect: /en, /zh, /en/create, /en/examples
```

2. GA4:

- Confirm Realtime page views.
- Confirm custom events from create flow after at least one generation.

3. Robots/noindex:

- Confirm public pages are indexable.
- Confirm private pages such as authenticated creation history are not submitted in sitemap.

## Phase 10: Rollback Plan

If production breaks immediately:

1. Use Vercel Instant Rollback to restore the previous deployment.
2. If the issue is environment variables, fix env and redeploy.
3. If the issue is Neon schema:

```bash
DATABASE_URL='<NEON_DIRECT_CONNECTION_STRING>' npx prisma db push
```

4. If generation fails but public site works:

- Set Kie-related env correctly.
- Keep marketing pages online.
- Temporarily hide `/create` from nav only if necessary.

## Known Risks Before Launch

- There is no Prisma migration history yet. `db push` is acceptable for first schema creation, but after launch switch to tracked migrations with `prisma migrate dev` / `prisma migrate deploy`.
- One R2 bucket currently holds both public marketing assets and user assets. Signed URLs protect discoverability for user assets, but the cleaner long-term architecture is two buckets: public assets and private user assets.
- Paid checkout should stay disabled until live Stripe Price IDs are added to `src/config/pricing.ts`.
- Vercel cron runs in UTC. The current schedule `0 0 * * *` is midnight UTC.
- Production env changes require a new deployment.

## Launch Go / No-Go Checklist

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Neon schema initialized with direct connection string.
- [ ] Vercel `DATABASE_URL` uses Neon pooled connection string.
- [ ] Vercel production env contains `AUTH_SECRET`, Google OAuth, Kie, R2, app URLs, and cron secret.
- [ ] Google OAuth production callback URL configured.
- [ ] R2 custom domain `assets.image-easy.com` returns `200`.
- [ ] `ENABLE_PAID_CREDITS=false` for first launch unless live Stripe is fully configured.
- [ ] Production deployment succeeds.
- [ ] Login creates a Neon user.
- [ ] One generation completes and is mirrored to R2.
- [ ] `/en/examples`, `/en/privacy`, `/en/terms`, `/en/legal`, `/en/contact`, `/en/about` return `200`.
- [ ] `sitemap.xml` returns `200` and is submitted to Search Console.
