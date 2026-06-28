# Image Easy Launch Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Image Easy 从“能跑的 AI 图片生成 demo”推进到“可以安全承接真实用户的 beta 产品”。

**Architecture:** 第一阶段先补齐上线底座：索引策略、R2 资产存储、credits 流水与成本保护、GA4/Search Console 数据闭环、基础信任页面。支付系统作为“收费上线”必做项；如果先免费 beta，可在第一阶段之后接 Stripe Checkout。

**Tech Stack:** Next.js 15 App Router, React 19 RC, next-intl, NextAuth/Auth.js v5, Prisma, PostgreSQL, Cloudflare R2 S3-compatible API, Google Analytics 4, Stripe Checkout.

---

## Scope Check

本计划覆盖多个独立子系统，不应该一次性混在一个超大 PR 里实现。推荐按下面顺序拆成 6 个小 PR：

1. SEO 索引和信任页
2. R2 对象存储
3. credits 流水和成本保护
4. GA4 / Search Console / 事件埋点
5. Stripe 支付和充值
6. 差异化增长页面与公开内容资产

第 1 到 4 项是免费 beta 上线前建议完成的最小集合。第 5 项如果你要一上线就收费，就是 P0；如果先验证流量和留存，可以放到 beta 后。

## Launch Policy

### 推荐上线方式

先做 **免费 beta**，保留每个用户 10 次免费生成，但加上成本保护和数据分析。这样可以尽快验证真实用户行为，不被支付系统拖慢。

### 免费 beta 必须满足

- 用户能用 Google 登录。
- 用户能上传图片、生成图片、查看历史。
- 上传图和生成图都归档到 Cloudflare R2。
- 用户 credits 有完整流水，不只是 `User.credits` 一个数字。
- 登录页和私有页不会被 Google 索引。
- 有 Privacy、Terms、Contact、Pricing 基础页面。
- GA4 能记录访问、注册、上传、提交生成、生成成功、生成失败、下载结果。
- 生产环境变量、数据库迁移、构建都能通过。

### 收费上线必须额外满足

- Stripe Checkout 可购买 credits。
- Stripe webhook 幂等处理。
- 付款成功后 credits 入账写流水。
- Pricing 页面说明价格、额度、退款/失败处理。
- 支付失败、取消、重复 webhook 都不会重复加 credits。

## File Structure Map

### Existing Files To Modify

- `src/app/sitemap.ts`  
  控制可索引页面列表。第一阶段移除 `/my-images`。

- `src/lib/page-metadata.ts`  
  为 `login`、`my-images` 支持页面级 robots 策略。

- `src/app/[locale]/login/page.tsx`  
  输出 `noindex, follow` metadata。

- `src/app/[locale]/my-images/page.tsx`  
  输出 `noindex, nofollow` metadata。

- `src/app/[locale]/page.tsx`  
  调整首页 CTA、Footer 链接，后续补 FAQ、模型对比和信任页入口。

- `src/components/Header.tsx`  
  后续支持 Pricing、Docs、Gallery 等导航，不在第一阶段强制扩展。

- `src/app/api/upload/route.ts`  
  从“上传到 kie.ai 后保存 URL”改为“先存 R2，再按模型需要上传/传递到 kie.ai”。

- `src/app/api/generate/route.ts`  
  在创建生成任务前做原子 credits 检查、任务占用、速率限制。

- `src/app/api/generate/[id]/route.ts`  
  生成完成后把模型返回图片复制到 R2，再写入 Generation 结果。

- `src/app/[locale]/create/create-content.tsx`  
  增加 GA4 事件：选择模型、上传图片、提交生成、生成成功、失败。

- `src/components/GenerationResult.tsx`  
  增加下载和复用事件。

- `prisma/schema.prisma`  
  增加 asset、credit ledger、payment 相关表。

- `messages/*.json`  
  增加信任页、定价页、错误提示和 footer 链接文案。

- `package.json`  
  R2 需要 AWS SDK；GA 可优先使用 Next.js script，不一定需要新包；Stripe 支付阶段需要 `stripe`。

### New Files To Create

- `src/lib/storage/r2.ts`  
  R2 客户端、对象 key 生成、上传、复制远程图片到 R2、signed URL。

- `src/lib/credits.ts`  
  credits 检查、预占、扣减、退款、流水记录。

- `src/lib/rate-limit.ts`  
  基于数据库的简单用户级速率限制；第一版不引入 Redis。

- `src/lib/analytics.ts`  
  客户端 GA4 事件封装。

- `src/components/GoogleAnalytics.tsx`  
  注入 GA4 tag，并在无 measurement id 时不输出脚本。

- `src/app/[locale]/pricing/page.tsx`
- `src/app/[locale]/privacy/page.tsx`
- `src/app/[locale]/terms/page.tsx`
- `src/app/[locale]/contact/page.tsx`
- `src/app/[locale]/about/page.tsx`  
  第一批信任页面。

- `src/app/api/checkout/route.ts`  
  Stripe Checkout 创建 session，支付阶段实现。

- `src/app/api/stripe/webhook/route.ts`  
  Stripe webhook 幂等处理，支付阶段实现。

- `docs/launch-checklist.md`  
  上线环境变量、部署、Search Console、GA4、R2、Stripe 检查清单。

---

## Milestone 1: SEO Indexing And Trust Baseline

**Outcome:** Google 只看到应该索引的公开页面，用户能看到基础信任信息。

### Task 1: Remove Private Pages From Sitemap

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/[locale]/login/page.tsx`
- Modify: `src/app/[locale]/my-images/page.tsx`
- Modify: `src/lib/page-metadata.ts`

- [ ] **Step 1: Update sitemap page list**

Change `PAGES` in `src/app/sitemap.ts` from:

```ts
const PAGES = ["/", "/create", "/my-images"] as const;
```

to:

```ts
const PAGES = ["/", "/create"] as const;
```

- [ ] **Step 2: Add page-level robots support**

Extend `generatePageMetadata` in `src/lib/page-metadata.ts` so `login` and `my-images` can return `robots` overrides:

```ts
const robots =
  page === "login"
    ? { index: false, follow: true }
    : page === "my-images"
    ? { index: false, follow: false }
    : { index: true, follow: true };
```

Include `robots` in the returned metadata object.

- [ ] **Step 3: Verify generated sitemap**

Run:

```bash
npm run build
```

Expected:

```text
✓ Compiled successfully
✓ Generating static pages
```

Then inspect sitemap output locally or through build artifacts and confirm `/my-images` is absent.

- [ ] **Step 4: Commit**

```bash
git add src/app/sitemap.ts src/lib/page-metadata.ts src/app/[locale]/login/page.tsx src/app/[locale]/my-images/page.tsx
git commit -m "fix: exclude private pages from search indexing"
```

### Task 2: Add Trust Pages

**Files:**
- Create: `src/app/[locale]/pricing/page.tsx`
- Create: `src/app/[locale]/privacy/page.tsx`
- Create: `src/app/[locale]/terms/page.tsx`
- Create: `src/app/[locale]/contact/page.tsx`
- Create: `src/app/[locale]/about/page.tsx`
- Modify: `src/i18n/routing.ts`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `messages/*.json`

- [ ] **Step 1: Add localized routes**

Add these pathnames to `src/i18n/routing.ts`:

```ts
export const pathnames = {
  "/": "/",
  "/create": "/create",
  "/my-images": "/my-images",
  "/login": "/login",
  "/pricing": "/pricing",
  "/privacy": "/privacy",
  "/terms": "/terms",
  "/contact": "/contact",
  "/about": "/about",
} as const;
```

- [ ] **Step 2: Create page shells**

Each trust page should be static, localized, and honest about current product behavior. Use existing typography and layout from the home page. Do not claim paid plans exist until Stripe is live.

Pricing first version:

```text
Free beta
10 free generations on sign-up.
Paid credit packs are coming soon.
```

Privacy first version must state:

```text
Users upload images and prompts to Image Easy.
Image Easy sends prompts and required image URLs to third-party AI model providers through kie.ai.
Image Easy stores account data, generation history, prompts, uploaded images, and generated image URLs.
```

Terms first version must state:

```text
Users are responsible for rights to uploaded images and generated outputs.
Users may not generate illegal, abusive, or rights-infringing content.
Image Easy may remove access or content that violates these terms.
```

- [ ] **Step 3: Replace footer spans with links**

In `src/app/[locale]/page.tsx`, change footer text-only items for Pricing, Contact, Privacy, Terms and Legal into `Link` components. If Legal does not have a separate page, point Legal to `/terms` for now.

- [ ] **Step 4: Verify**

Run:

```bash
npm run lint
npm run build
```

Expected:

```text
tsc --noEmit --incremental false
✓ Compiled successfully
```

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/pricing src/app/[locale]/privacy src/app/[locale]/terms src/app/[locale]/contact src/app/[locale]/about src/i18n/routing.ts src/app/[locale]/page.tsx messages
git commit -m "feat: add launch trust pages"
```

---

## Milestone 2: Cloudflare R2 Asset Storage

**Outcome:** 用户上传图和生成结果归档到 Image Easy 自己的 R2 存储，历史记录不依赖第三方临时 URL。

### Task 3: Add R2 Storage Layer

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`
- Create: `src/lib/storage/r2.ts`
- Create: `src/lib/storage/keys.ts`

- [ ] **Step 1: Install AWS SDK**

Run:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Add environment variables**

Document these variables in `README.md` and deployment settings:

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
R2_SIGNED_URL_TTL_SECONDS=3600
```

- [ ] **Step 3: Add Asset model**

Add an `Asset` model to `prisma/schema.prisma`:

```prisma
model Asset {
  id          String   @id @default(cuid())
  userId      String
  kind        String   // upload, generated
  bucket      String
  key         String   @unique
  url         String?
  filename    String
  mimeType    String
  size        Int
  width       Int?
  height      Int?
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([kind])
  @@index([createdAt])
}
```

Add relation on `User`:

```prisma
assets Asset[]
```

- [ ] **Step 4: Create R2 client**

`src/lib/storage/r2.ts` should export:

```ts
export async function putObjectToR2(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ bucket: string; key: string; url?: string }>;

export async function copyRemoteImageToR2(input: {
  sourceUrl: string;
  key: string;
}): Promise<{ bucket: string; key: string; url?: string; size: number; mimeType: string }>;

export async function getSignedAssetUrl(key: string): Promise<string>;
```

The implementation uses `S3Client` with endpoint:

```ts
`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
```

- [ ] **Step 5: Create stable object key helper**

`src/lib/storage/keys.ts` should export:

```ts
export function userUploadKey(userId: string, filename: string) {
  return `users/${userId}/uploads/${Date.now()}-${filename}`;
}

export function generatedImageKey(userId: string, generationId: string, index: number, extension: string) {
  return `users/${userId}/generated/${generationId}/${index}.${extension}`;
}
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma src/lib/storage README.md
git commit -m "feat: add r2 asset storage layer"
```

### Task 4: Store Uploads In R2

**Files:**
- Modify: `src/app/api/upload/route.ts`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Decode base64 upload**

In `src/app/api/upload/route.ts`, decode `base64Data` into a `Buffer`, validate size from bytes rather than string length, and upload to R2.

- [ ] **Step 2: Preserve kie.ai compatibility**

For image-to-image generation, keep the current kie.ai upload flow until the model API can read R2 URLs directly. Store both:

```ts
{
  r2Key: asset.key,
  providerUrl: result.downloadUrl
}
```

First implementation can keep `Upload.url` as the provider URL and add R2 fields:

```prisma
r2Key String?
r2Url String?
providerUrl String?
```

- [ ] **Step 3: Return R2 metadata to client**

Return:

```ts
{
  uploadId,
  url,
  r2Key,
  fileName,
  size
}
```

The client can continue using `url` without UI changes.

- [ ] **Step 4: Verify upload route type safety**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/upload/route.ts prisma/schema.prisma
git commit -m "feat: archive uploads to r2"
```

### Task 5: Mirror Generated Results To R2

**Files:**
- Modify: `src/app/api/generate/[id]/route.ts`
- Modify: `prisma/schema.prisma`
- Modify: `src/components/HistoryGrid.tsx`
- Modify: `src/components/GenerationResult.tsx`

- [ ] **Step 1: Add result storage fields**

Keep `Generation.resultUrls` for backward compatibility, but add:

```prisma
resultAssetKeys String?
```

This stores a JSON array of R2 keys for generated assets.

- [ ] **Step 2: Copy model result URLs to R2 on completion**

When generation status becomes completed:

1. Iterate model result URLs.
2. Copy each remote image to R2.
3. Store R2 public URL or signed URL source in `resultUrls`.
4. Store R2 keys in `resultAssetKeys`.

- [ ] **Step 3: Keep failure behavior unchanged**

If R2 copy fails after model generation succeeds, mark generation as failed with a clear error:

```text
Image generated but storage failed. Please retry.
```

Do not decrement credits until R2 storage succeeds.

- [ ] **Step 4: Verify history still renders**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate/[id]/route.ts prisma/schema.prisma src/components/HistoryGrid.tsx src/components/GenerationResult.tsx
git commit -m "feat: persist generated images to r2"
```

---

## Milestone 3: Credits Ledger And Cost Protection

**Outcome:** 用户额度、消耗、退款、人工调整都有可审计流水，防止成本被刷。

### Task 6: Add Credit Ledger

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/credits.ts`
- Modify: `src/app/api/generate/route.ts`
- Modify: `src/app/api/generate/[id]/route.ts`

- [ ] **Step 1: Add CreditTransaction model**

```prisma
model CreditTransaction {
  id           String   @id @default(cuid())
  userId       String
  generationId String?
  type         String   // grant, reserve, consume, refund, purchase, admin_adjust
  amount       Int
  balanceAfter Int
  reason       String
  metadata     String?
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([generationId])
  @@index([createdAt])
}
```

Add relation on `User`:

```prisma
creditTransactions CreditTransaction[]
```

- [ ] **Step 2: Implement atomic credit helpers**

`src/lib/credits.ts` should export:

```ts
export async function reserveGenerationCredit(input: {
  userId: string;
  amount: number;
  reason: string;
}): Promise<{ balanceAfter: number }>;

export async function consumeReservedCredit(input: {
  userId: string;
  generationId: string;
  amount: number;
  reason: string;
}): Promise<void>;

export async function refundGenerationCredit(input: {
  userId: string;
  generationId: string;
  amount: number;
  reason: string;
}): Promise<void>;
```

Use `prisma.$transaction` and conditional update so credits never go below zero.

- [ ] **Step 3: Reserve before task creation**

In `src/app/api/generate/route.ts`:

1. Determine estimated cost.
2. Reserve credits before calling kie.ai.
3. If kie.ai task creation fails, refund immediately.

- [ ] **Step 4: Consume after successful R2 persistence**

In `src/app/api/generate/[id]/route.ts`, consume reserved credit only after:

1. Provider says completed.
2. Result images copied to R2.
3. Database generation status updated to completed.

- [ ] **Step 5: Refund failed provider tasks**

When provider task fails, update generation status to failed and refund reserved credits.

- [ ] **Step 6: Verify**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/lib/credits.ts src/app/api/generate src/app/api/generate/[id]
git commit -m "feat: add credit ledger and reservation flow"
```

### Task 7: Add Basic Rate Limits

**Files:**
- Create: `src/lib/rate-limit.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/generate/route.ts`

- [ ] **Step 1: Define limits**

First beta limits:

```text
Max upload requests per user per hour: 60
Max generation requests per user per hour: 20
Max concurrent processing generations per user: 2
```

- [ ] **Step 2: Implement database-backed checks**

`src/lib/rate-limit.ts` should export:

```ts
export async function assertCanUpload(userId: string): Promise<void>;
export async function assertCanGenerate(userId: string): Promise<void>;
```

Use existing `Upload` and `Generation` tables for the first version:

- count uploads created in last hour
- count generations created in last hour
- count generations with status `pending` or `processing`

- [ ] **Step 3: Return 429 on limit hit**

In API routes, catch rate limit errors and return:

```ts
return NextResponse.json(
  { error: "Rate limit reached. Please try again later." },
  { status: 429 },
);
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit.ts src/app/api/upload/route.ts src/app/api/generate/route.ts
git commit -m "feat: add beta rate limits"
```

---

## Milestone 4: Analytics And Search Measurement

**Outcome:** 上线第一天就能看到访问、转化、生成成功率和失败率。

### Task 8: Add GA4 Page Tracking

**Files:**
- Create: `src/components/GoogleAnalytics.tsx`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `README.md`

- [ ] **Step 1: Add environment variable**

Document:

```text
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

- [ ] **Step 2: Create GA component**

`GoogleAnalytics` should:

- return `null` when env var is missing
- inject `https://www.googletagmanager.com/gtag/js?id=...`
- initialize `window.dataLayer`

- [ ] **Step 3: Include in root layout**

Add `<GoogleAnalytics />` in `src/app/[locale]/layout.tsx` inside `<body>`.

- [ ] **Step 4: Verify**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/GoogleAnalytics.tsx src/app/[locale]/layout.tsx README.md
git commit -m "feat: add google analytics tracking"
```

### Task 9: Add Product Events

**Files:**
- Create: `src/lib/analytics.ts`
- Modify: `src/app/[locale]/create/create-content.tsx`
- Modify: `src/components/ImageUploader.tsx`
- Modify: `src/components/ModelSelector.tsx`
- Modify: `src/components/GenerationResult.tsx`

- [ ] **Step 1: Create event wrapper**

`src/lib/analytics.ts` should export:

```ts
export function trackEvent(name: string, params?: Record<string, string | number | boolean | undefined>) {
  if (typeof window === "undefined") return;
  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;
  gtag("event", name, params ?? {});
}
```

- [ ] **Step 2: Track first event set**

Add events:

```text
select_model
upload_image
submit_generation
generation_completed
generation_failed
download_result
copy_result_url
reuse_prompt
```

Required common params:

```text
model
capability
locale
has_reference_image
status
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/analytics.ts src/app/[locale]/create/create-content.tsx src/components/ImageUploader.tsx src/components/ModelSelector.tsx src/components/GenerationResult.tsx
git commit -m "feat: track generation funnel events"
```

### Task 10: Add Search Console Checklist

**Files:**
- Create: `docs/launch-checklist.md`

- [ ] **Step 1: Add checklist**

Include:

```text
Verify https://www.image-easy.com in Google Search Console.
Submit https://www.image-easy.com/sitemap.xml.
Inspect /en, /en/create, /zh, /zh/create.
Confirm /en/login and /en/my-images are noindex.
Connect GA4 property.
Confirm Realtime report receives page_view.
Confirm custom events appear in DebugView.
```

- [ ] **Step 2: Commit**

```bash
git add docs/launch-checklist.md
git commit -m "docs: add launch measurement checklist"
```

---

## Milestone 5: Stripe Payments

**Outcome:** 用户可以购买 credits，支付成功后可靠入账。

Run this milestone before public launch if the first public version is paid. If the first launch is free beta, run it after initial traffic validation.

### Task 11: Add Payment Schema

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Install Stripe**

```bash
npm install stripe
```

- [ ] **Step 2: Add payment tables**

Add:

```prisma
model CreditPackage {
  id          String   @id @default(cuid())
  name        String
  credits     Int
  priceCents  Int
  currency    String   @default("usd")
  stripePriceId String @unique
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model Payment {
  id                    String   @id @default(cuid())
  userId                String
  stripeCheckoutSessionId String @unique
  stripePaymentIntentId String?
  amountCents           Int
  currency              String
  credits               Int
  status                String   // pending, paid, failed, canceled
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
}

model StripeWebhookEvent {
  id        String   @id
  type      String
  processedAt DateTime @default(now())
}
```

Add relation on `User`:

```prisma
payments Payment[]
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma
git commit -m "feat: add payment schema"
```

### Task 12: Add Checkout And Webhook

**Files:**
- Create: `src/lib/stripe.ts`
- Create: `src/app/api/checkout/route.ts`
- Create: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/app/[locale]/pricing/page.tsx`

- [ ] **Step 1: Add environment variables**

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=https://www.image-easy.com
```

- [ ] **Step 2: Implement checkout route**

Route behavior:

1. Require logged-in user.
2. Accept `priceId`.
3. Create Stripe Checkout session.
4. Create local `Payment` with `pending`.
5. Return `session.url`.

- [ ] **Step 3: Implement webhook route**

Webhook behavior:

1. Verify Stripe signature.
2. Skip if event id already exists in `StripeWebhookEvent`.
3. On `checkout.session.completed`, mark payment paid.
4. Add credits using `CreditTransaction` type `purchase`.
5. Save processed event id.

- [ ] **Step 4: Wire Pricing page**

Pricing page should show beta/free state when no active packages exist. When packages exist, show buy buttons.

- [ ] **Step 5: Verify**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe.ts src/app/api/checkout src/app/api/stripe src/app/[locale]/pricing/page.tsx
git commit -m "feat: add stripe checkout for credits"
```

---

## Milestone 6: Differentiation After Safe Launch

**Outcome:** 网站从“能生成图”升级为“多模型选择和对比工作台”，形成 SEO 与产品差异化。

### Task 13: Multi-Model Comparison MVP

**Files:**
- Create: `src/app/[locale]/compare/page.tsx`
- Create: `src/components/ModelComparisonLauncher.tsx`
- Modify: `src/app/api/generate/route.ts`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add comparison group model**

Add:

```prisma
model ComparisonRun {
  id        String   @id @default(cuid())
  userId    String
  prompt    String
  modelIds  String
  generationIds String?
  status    String   @default("pending")
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

- [ ] **Step 2: Add page**

`/compare` lets a user enter one prompt and select 2 to 3 models. Submit creates multiple generation tasks.

- [ ] **Step 3: Track cost clearly**

Before submit, show:

```text
This comparison will use N credits.
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/compare src/components/ModelComparisonLauncher.tsx src/app/api/generate/route.ts prisma/schema.prisma
git commit -m "feat: add multi-model comparison flow"
```

### Task 14: SEO Content Cluster

**Files:**
- Create: `src/app/[locale]/models/page.tsx`
- Create: `src/app/[locale]/models/[model]/page.tsx`
- Create: `src/app/[locale]/use-cases/product-photos/page.tsx`
- Modify: `src/app/sitemap.ts`
- Modify: `messages/*.json`

- [ ] **Step 1: Add model pages**

Each model page must include:

```text
What this model is best for
Supported inputs
Supported sizes
Prompt examples
Known limitations
CTA to create with this model
```

- [ ] **Step 2: Add first use-case page**

Start with:

```text
/use-cases/product-photos
```

Reason: high commercial intent and close to paid conversion.

- [ ] **Step 3: Add sitemap entries**

Only include pages with real content and no login requirement.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/models src/app/[locale]/use-cases src/app/sitemap.ts messages
git commit -m "feat: add model and product photo seo pages"
```

---

## Recommended Execution Order

### Beta Launch Path

1. Milestone 1: SEO Indexing And Trust Baseline
2. Milestone 2: Cloudflare R2 Asset Storage
3. Milestone 3: Credits Ledger And Cost Protection
4. Milestone 4: Analytics And Search Measurement
5. Deploy beta
6. Watch GA4, Search Console, generation success rate, storage cost, API cost
7. Milestone 5: Stripe Payments
8. Milestone 6: Differentiation After Safe Launch

### Paid Launch Path

1. Milestone 1
2. Milestone 2
3. Milestone 3
4. Milestone 4
5. Milestone 5
6. Deploy paid launch
7. Milestone 6

## Acceptance Gates

### Gate A: Before Beta Launch

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `/my-images` absent from sitemap.
- [ ] `/login` has noindex metadata.
- [ ] `/my-images` has noindex metadata.
- [ ] User upload creates R2 object.
- [ ] Completed generation creates R2 object.
- [ ] Failed generation refunds or does not consume credits.
- [ ] GA4 receives `page_view`.
- [ ] GA4 receives `submit_generation`.
- [ ] Privacy, Terms, Pricing, Contact are reachable from footer.
- [ ] Production env vars are documented.

### Gate B: Before Paid Launch

- [ ] Stripe Checkout opens from Pricing page.
- [ ] Stripe webhook verifies signature.
- [ ] Duplicate webhook does not duplicate credits.
- [ ] Payment success adds credits and writes `CreditTransaction`.
- [ ] Payment cancel does not add credits.
- [ ] Pricing page accurately describes packages.

## Non-Goals For First Launch

- Do not add more image models before R2 and credits ledger are stable.
- Do not build a full admin dashboard before manual database operations are enough.
- Do not build subscriptions before credit packs are validated.
- Do not build public gallery before privacy and R2 ownership rules are clear.
- Do not localize URL slugs until the core launch pages are stable.

## Self-Review

- Spec coverage: covers user-raised payment, R2, Google analytics, plus previously found SEO/private page/trust/content issues.
- Placeholder scan: no empty placeholder markers remain.
- Type consistency: Prisma names and helper names are stable across tasks.
- Scope check: plan is intentionally split into 6 milestones because this is too broad for one implementation PR.
