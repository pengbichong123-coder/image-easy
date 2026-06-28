# Billing Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user-facing billing closure needed before paid launch: current plan display, credit usage history, payment history, Stripe Customer Portal, and webhook handling for failed payments and refunds.

**Architecture:** Keep Stripe as the source of truth for subscription management and invoices. Store a small local billing event ledger for user display and support, while continuing to use `CreditTransaction` as the source of truth for credit balance and credit usage. Expose a protected `/billing` page that reads server-side data from Prisma and uses a small client button to open Stripe Customer Portal.

**Tech Stack:** Next.js App Router, NextAuth/Auth.js, Prisma/PostgreSQL, Stripe Checkout/Portal/Webhooks, next-intl messages, node:test.

---

## Scope

This plan covers the paid-user closure for launch:
- Current plan and subscription status.
- Credit usage records.
- Payment and subscription billing records.
- Stripe Customer Portal entry point.
- `invoice.payment_failed` handling.
- Refund event recording.

This plan intentionally does **not** implement automatic credit clawback on refunds. First version records refund events for support and visibility; clawback rules should be a separate product decision because users may already have spent granted credits.

## Files

- Modify: `prisma/schema.prisma`
  Add `BillingEvent` model for Stripe invoice/payment/refund history.
- Create: `src/lib/billing-events.ts`
  Normalize billing event creation, amount formatting data, event type labels, and idempotency helpers.
- Create: `src/lib/billing-overview.ts`
  Server helper to load current user credits, active subscription, credit transactions, and billing events.
- Create: `src/app/[locale]/billing/page.tsx`
  Protected billing page.
- Create: `src/components/BillingPortalButton.tsx`
  Client button that calls `/api/billing/portal`.
- Create: `src/app/api/billing/portal/route.ts`
  Creates Stripe Customer Portal sessions.
- Modify: `src/app/api/stripe/webhook/route.ts`
  Record billing events and handle failed-payment/refund events.
- Modify: `src/components/Header.tsx`
  Add Billing entry in signed-in user menu.
- Modify: `src/i18n/routing.ts`
  Add `/billing`.
- Modify: `messages/*.json`
  Add nav/account/billing labels.
- Create: `tests/billing-events.test.mjs`
  Unit tests for event normalization/idempotency helpers.
- Create: `tests/billing-overview.test.mjs`
  Unit tests for display mapping and status priority.

---

### Task 1: Add Billing Event Storage

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `tests/billing-events.test.mjs`

- [ ] **Step 1: Add the Prisma model**

Add this model after `Payment` and before `UserSubscription`:

```prisma
model BillingEvent {
  id                    String   @id @default(cuid())
  userId                String
  subscriptionId        String?
  stripeEventId         String   @unique
  stripeInvoiceId       String?
  stripePaymentIntentId String?
  stripeChargeId        String?
  stripeRefundId        String?
  type                  String   // checkout_completed, invoice_paid, invoice_payment_failed, refund_created
  status                String   // paid, failed, refunded, informational
  amountCents           Int?
  currency              String?
  description           String?
  hostedInvoiceUrl      String?
  invoicePdf            String?
  occurredAt            DateTime
  metadata              String?
  createdAt             DateTime @default(now())

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscription UserSubscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  @@index([userId, occurredAt])
  @@index([subscriptionId])
  @@index([type])
  @@index([status])
}
```

Add relations:

```prisma
model User {
  // existing fields
  billingEvents BillingEvent[]
}

model UserSubscription {
  // existing fields
  billingEvents BillingEvent[]
}
```

- [ ] **Step 2: Generate Prisma client**

Run:

```bash
npm run db:generate
```

Expected: Prisma client generation succeeds.

- [ ] **Step 3: Apply local database schema**

Run:

```bash
npm run db:push
```

Expected: database schema sync succeeds. If production uses migrations later, create a SQL migration before deploy.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add billing event ledger"
```

---

### Task 2: Add Billing Event Helpers

**Files:**
- Create: `src/lib/billing-events.ts`
- Create: `tests/billing-events.test.mjs`

- [ ] **Step 1: Write tests for pure helpers**

Create `tests/billing-events.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadModule() {
  const source = fs.readFileSync(new URL("../src/lib/billing-events.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: module.exports,
    module,
  });
  return module.exports;
}

test("billing event labels are stable", () => {
  const { billingEventLabel } = loadModule();

  assert.equal(billingEventLabel("invoice_paid"), "Invoice paid");
  assert.equal(billingEventLabel("invoice_payment_failed"), "Payment failed");
  assert.equal(billingEventLabel("refund_created"), "Refund recorded");
  assert.equal(billingEventLabel("unknown_type"), "Billing event");
});

test("billing event status priority surfaces failed payments first", () => {
  const { mostImportantBillingStatus } = loadModule();

  assert.equal(mostImportantBillingStatus(["paid", "failed"]), "failed");
  assert.equal(mostImportantBillingStatus(["paid", "refunded"]), "refunded");
  assert.equal(mostImportantBillingStatus(["paid"]), "paid");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test tests/billing-events.test.mjs
```

Expected: fails because `src/lib/billing-events.ts` does not exist.

- [ ] **Step 3: Implement helper file**

Create `src/lib/billing-events.ts`:

```ts
export type BillingEventType =
  | "checkout_completed"
  | "invoice_paid"
  | "invoice_payment_failed"
  | "refund_created";

export type BillingEventStatus =
  | "paid"
  | "failed"
  | "refunded"
  | "informational";

export function billingEventLabel(type: string) {
  if (type === "checkout_completed") return "Checkout completed";
  if (type === "invoice_paid") return "Invoice paid";
  if (type === "invoice_payment_failed") return "Payment failed";
  if (type === "refund_created") return "Refund recorded";
  return "Billing event";
}

export function mostImportantBillingStatus(statuses: string[]) {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("refunded")) return "refunded";
  if (statuses.includes("paid")) return "paid";
  return "informational";
}

export function stripeAmountToCents(value: number | null | undefined) {
  return typeof value === "number" ? value : null;
}

export function stripeCurrency(value: string | null | undefined) {
  return value ? value.toLowerCase() : null;
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
node --test tests/billing-events.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing-events.ts tests/billing-events.test.mjs
git commit -m "feat: add billing event helpers"
```

---

### Task 3: Record Stripe Billing Events

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/lib/billing-events.ts`
- Test: `tests/billing-events.test.mjs`

- [ ] **Step 1: Add webhook event support**

Update the webhook router to handle these events:

```ts
event.type === "invoice.payment_failed"
event.type === "charge.refunded"
event.type === "refund.created"
```

For `invoice.payment_failed`:
- Find `stripeSubscriptionId` and local subscription.
- Update local subscription status to `past_due`.
- Create `BillingEvent` with:
  - `type: "invoice_payment_failed"`
  - `status: "failed"`
  - `stripeInvoiceId: invoice.id`
  - `amountCents: invoice.amount_due`
  - `currency: invoice.currency`
  - `hostedInvoiceUrl: invoice.hosted_invoice_url`
  - `invoicePdf: invoice.invoice_pdf`
  - `occurredAt: stripeDate(invoice.created) ?? new Date()`

For `invoice.paid`, after the existing credit grant succeeds, also create `BillingEvent` with:
- `type: "invoice_paid"`
- `status: "paid"`
- invoice amount/currency/URLs.

For `charge.refunded` or `refund.created`:
- Record `BillingEvent`.
- Do not deduct credits in this task.
- If `userId` cannot be resolved safely, log and skip local event creation instead of throwing.

- [ ] **Step 2: Keep webhook idempotency**

Use existing `StripeWebhookEvent` idempotency. Also use `BillingEvent.stripeEventId` unique constraint so the event ledger cannot duplicate rows if webhook retry logic changes later.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run lint
```

Expected: typecheck passes.

- [ ] **Step 4: Run billing tests**

Run:

```bash
node --test tests/billing-events.test.mjs tests/subscription-credit-grants.test.mjs tests/subscription-plans.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts src/lib/billing-events.ts tests/billing-events.test.mjs
git commit -m "feat: record stripe billing events"
```

---

### Task 4: Add Billing Overview Loader

**Files:**
- Create: `src/lib/billing-overview.ts`
- Create: `tests/billing-overview.test.mjs`

- [ ] **Step 1: Write tests for display mapping**

Create `tests/billing-overview.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadModule() {
  const source = fs.readFileSync(new URL("../src/lib/billing-overview.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: module.exports,
    module,
  });
  return module.exports;
}

test("credit transaction labels are user friendly", () => {
  const { creditTransactionLabel } = loadModule();

  assert.equal(creditTransactionLabel("reserve"), "Generation reserved");
  assert.equal(creditTransactionLabel("consume"), "Generation completed");
  assert.equal(creditTransactionLabel("refund"), "Generation refunded");
  assert.equal(creditTransactionLabel("subscription_grant"), "Subscription credits");
  assert.equal(creditTransactionLabel("purchase"), "Purchased credits");
});

test("subscription status labels are user friendly", () => {
  const { subscriptionStatusLabel } = loadModule();

  assert.equal(subscriptionStatusLabel("active"), "Active");
  assert.equal(subscriptionStatusLabel("past_due"), "Payment failed");
  assert.equal(subscriptionStatusLabel("canceled"), "Canceled");
  assert.equal(subscriptionStatusLabel("unknown"), "Unknown");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test tests/billing-overview.test.mjs
```

Expected: fails because `src/lib/billing-overview.ts` does not exist.

- [ ] **Step 3: Implement overview helper**

Create `src/lib/billing-overview.ts`:

```ts
import { prisma } from "@/lib/db";

export function creditTransactionLabel(type: string) {
  if (type === "grant") return "Free credits";
  if (type === "reserve") return "Generation reserved";
  if (type === "consume") return "Generation completed";
  if (type === "refund") return "Generation refunded";
  if (type === "purchase") return "Purchased credits";
  if (type === "subscription_grant") return "Subscription credits";
  if (type === "admin_adjust") return "Manual adjustment";
  return "Credit transaction";
}

export function subscriptionStatusLabel(status: string | null | undefined) {
  if (status === "active") return "Active";
  if (status === "trialing") return "Trialing";
  if (status === "past_due") return "Payment failed";
  if (status === "unpaid") return "Unpaid";
  if (status === "canceled") return "Canceled";
  if (status === "incomplete") return "Incomplete";
  if (status === "incomplete_expired") return "Expired";
  return "Unknown";
}

export async function getBillingOverview(userId: string) {
  const [user, subscription, creditTransactions, billingEvents] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true },
    }),
    prisma.userSubscription.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        planId: true,
        tier: true,
        interval: true,
        status: true,
        monthlyCredits: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        nextCreditGrantAt: true,
        stripeCustomerId: true,
      },
    }),
    prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        reason: true,
        generationId: true,
        paymentId: true,
        subscriptionId: true,
        createdAt: true,
      },
    }),
    prisma.billingEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        amountCents: true,
        currency: true,
        description: true,
        hostedInvoiceUrl: true,
        invoicePdf: true,
        occurredAt: true,
      },
    }),
  ]);

  return {
    credits: user.credits,
    subscription,
    creditTransactions,
    billingEvents,
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
node --test tests/billing-overview.test.mjs
npm run lint
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing-overview.ts tests/billing-overview.test.mjs
git commit -m "feat: add billing overview loader"
```

---

### Task 5: Add Stripe Customer Portal API

**Files:**
- Create: `src/app/api/billing/portal/route.ts`
- Modify: `.env.example`

- [ ] **Step 1: Implement portal route**

Create `src/app/api/billing/portal/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { buildCheckoutReturnUrls } from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function getReturnUrl(req: NextRequest, locale?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const origin = configured && configured.trim().length > 0 ? configured : req.nextUrl.origin;
  const { successUrl } = buildCheckoutReturnUrls(origin, locale);
  return successUrl.replace("/pricing?checkout=success", "/billing");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId: session.user.id,
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { stripeCustomerId: true },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 });
  }

  const stripe = getStripeClient();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: getReturnUrl(req, typeof body.locale === "string" ? body.locale : undefined),
  });

  return NextResponse.json({ url: portalSession.url });
}
```

- [ ] **Step 2: Update `.env.example`**

Add:

```bash
# Required for Stripe Checkout/Portal return URLs in production.
NEXT_PUBLIC_APP_URL=https://image-easy.com
```

- [ ] **Step 3: Manual Stripe dashboard setup**

In Stripe Dashboard sandbox and production:
- Open Billing → Customer portal.
- Enable portal.
- Allow customers to cancel subscriptions.
- Allow customers to update payment methods.
- Allow customers to view invoices.
- Save settings.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: typecheck passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/billing/portal/route.ts .env.example
git commit -m "feat: add stripe customer portal route"
```

---

### Task 6: Build `/billing` Page

**Files:**
- Create: `src/app/[locale]/billing/page.tsx`
- Create: `src/components/BillingPortalButton.tsx`
- Modify: `src/i18n/routing.ts`
- Modify: `src/components/Header.tsx`
- Modify: `messages/*.json`

- [ ] **Step 1: Add route**

Update `src/i18n/routing.ts`:

```ts
export const pathnames = {
  "/": "/",
  "/create": "/create",
  "/my-images": "/my-images",
  "/login": "/login",
  "/pricing": "/pricing",
  "/billing": "/billing",
  "/privacy": "/privacy",
  "/terms": "/terms",
  "/contact": "/contact",
  "/about": "/about",
} as const;
```

- [ ] **Step 2: Add messages**

Add `billing` namespace to every `messages/*.json`. For `messages/zh.json`:

```json
"billing": {
  "metaTitle": "账单",
  "kicker": "账户",
  "title": "账单与积分",
  "lead": "查看你的当前套餐、积分流水和付款记录。",
  "currentCredits": "当前积分",
  "currentPlan": "当前套餐",
  "noPlan": "暂无订阅套餐",
  "status": "状态",
  "monthlyCredits": "每月积分",
  "nextGrant": "下次积分发放",
  "periodEnd": "当前周期结束",
  "manageSubscription": "管理订阅",
  "portalOpening": "正在打开…",
  "portalFailed": "无法打开订阅管理，请稍后重试。",
  "paymentFailedTitle": "扣费失败",
  "paymentFailedBody": "你的订阅扣费失败。请更新支付方式，以免影响后续积分发放。",
  "creditHistory": "积分记录",
  "billingHistory": "付费记录",
  "emptyCreditHistory": "暂无积分记录。",
  "emptyBillingHistory": "暂无付费记录。",
  "amount": "变动",
  "balance": "余额",
  "time": "时间",
  "type": "类型",
  "invoice": "账单",
  "viewInvoice": "查看账单"
}
```

Use equivalent translations for other locales. If speed matters, use English fallback text for non-Chinese locales and polish translations later.

- [ ] **Step 3: Create portal button**

Create `src/components/BillingPortalButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

export function BillingPortalButton({
  label,
  loadingLabel,
  errorLabel,
}: {
  label: string;
  loadingLabel: string;
  errorLabel: string;
}) {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        setError(errorLabel);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(errorLabel);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? loadingLabel : label}
      </button>
      {error ? <p className="mt-3 text-[13px] text-[#D70015]">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Create billing page**

Create `src/app/[locale]/billing/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getBillingOverview, creditTransactionLabel, subscriptionStatusLabel } from "@/lib/billing-overview";
import { BillingPortalButton } from "@/components/BillingPortalButton";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing" });
  return { title: t("metaTitle") };
}

function formatDate(value: Date | null | undefined, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

function formatMoney(amountCents: number | null, currency: string | null, locale: string) {
  if (typeof amountCents !== "number" || !currency) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export default async function BillingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login?callbackUrl=/billing", locale });
  }

  const t = await getTranslations("billing");
  const overview = await getBillingOverview(session.user.id);
  const subscription = overview.subscription;
  const paymentFailed = subscription?.status === "past_due" || subscription?.status === "unpaid";

  return (
    <main className="max-w-[980px] mx-auto px-5 py-20 sm:py-28">
      <div className="text-[14px] text-[#6E6E73] mb-3">{t("kicker")}</div>
      <h1 className="display text-[48px] sm:text-[64px] text-[#1D1D1F] mb-5">{t("title")}</h1>
      <p className="text-[19px] text-[#6E6E73] max-w-2xl">{t("lead")}</p>

      {paymentFailed ? (
        <div className="mt-8 rounded-[8px] border border-[#F1D6A7] bg-[#FFF9EF] px-4 py-3 text-[14px] text-[#7A4E00]">
          <strong>{t("paymentFailedTitle")}</strong>
          <p className="mt-1">{t("paymentFailedBody")}</p>
        </div>
      ) : null}

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[8px] border border-[#E5E5E7] p-5">
          <div className="text-[13px] text-[#6E6E73]">{t("currentCredits")}</div>
          <div className="mt-3 text-[36px] font-semibold text-[#1D1D1F]">{overview.credits.toLocaleString()}</div>
        </div>
        <div className="rounded-[8px] border border-[#E5E5E7] p-5 sm:col-span-2">
          <div className="text-[13px] text-[#6E6E73]">{t("currentPlan")}</div>
          <div className="mt-3 text-[28px] font-semibold text-[#1D1D1F]">
            {subscription ? `${subscription.tier} / ${subscription.interval}` : t("noPlan")}
          </div>
          <div className="mt-3 grid gap-2 text-[14px] text-[#6E6E73] sm:grid-cols-2">
            <div>{t("status")}: {subscriptionStatusLabel(subscription?.status)}</div>
            <div>{t("monthlyCredits")}: {subscription?.monthlyCredits?.toLocaleString() ?? "—"}</div>
            <div>{t("nextGrant")}: {formatDate(subscription?.nextCreditGrantAt, locale)}</div>
            <div>{t("periodEnd")}: {formatDate(subscription?.currentPeriodEnd, locale)}</div>
          </div>
          {subscription?.stripeCustomerId ? (
            <div className="mt-5">
              <BillingPortalButton
                label={t("manageSubscription")}
                loadingLabel={t("portalOpening")}
                errorLabel={t("portalFailed")}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">{t("creditHistory")}</h2>
        {overview.creditTransactions.length === 0 ? (
          <p className="text-[#6E6E73]">{t("emptyCreditHistory")}</p>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-[#E5E5E7]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[#F5F5F7] text-[#6E6E73]">
                <tr>
                  <th className="px-4 py-3">{t("time")}</th>
                  <th className="px-4 py-3">{t("type")}</th>
                  <th className="px-4 py-3 text-right">{t("amount")}</th>
                  <th className="px-4 py-3 text-right">{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.creditTransactions.map((item) => (
                  <tr key={item.id} className="border-t border-[#E5E5E7]">
                    <td className="px-4 py-3 text-[#6E6E73]">{formatDate(item.createdAt, locale)}</td>
                    <td className="px-4 py-3 text-[#1D1D1F]">{creditTransactionLabel(item.type)}</td>
                    <td className="px-4 py-3 text-right tabular">{item.amount > 0 ? `+${item.amount}` : item.amount}</td>
                    <td className="px-4 py-3 text-right tabular">{item.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">{t("billingHistory")}</h2>
        {overview.billingEvents.length === 0 ? (
          <p className="text-[#6E6E73]">{t("emptyBillingHistory")}</p>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-[#E5E5E7]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[#F5F5F7] text-[#6E6E73]">
                <tr>
                  <th className="px-4 py-3">{t("time")}</th>
                  <th className="px-4 py-3">{t("type")}</th>
                  <th className="px-4 py-3 text-right">{t("amount")}</th>
                  <th className="px-4 py-3 text-right">{t("invoice")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.billingEvents.map((item) => (
                  <tr key={item.id} className="border-t border-[#E5E5E7]">
                    <td className="px-4 py-3 text-[#6E6E73]">{formatDate(item.occurredAt, locale)}</td>
                    <td className="px-4 py-3 text-[#1D1D1F]">{item.description ?? item.type}</td>
                    <td className="px-4 py-3 text-right tabular">{formatMoney(item.amountCents, item.currency, locale)}</td>
                    <td className="px-4 py-3 text-right">
                      {item.hostedInvoiceUrl ? (
                        <a href={item.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-[#0066CC] hover:underline">
                          {t("viewInvoice")}
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Add Header menu link**

In signed-in avatar dropdown in `src/components/Header.tsx`, add:

```tsx
<Link
  href="/billing"
  onClick={() => setMenuOpen(false)}
  className="block px-3 py-2 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-md"
>
  {tNav("billing")}
</Link>
```

Add `billing` under `nav` in every `messages/*.json`, e.g. Chinese:

```json
"billing": "账单"
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run lint
```

Expected: typecheck passes.

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/billing/page.tsx src/components/BillingPortalButton.tsx src/i18n/routing.ts src/components/Header.tsx messages
git commit -m "feat: add billing account page"
```

---

### Task 7: Manual QA

**Files:**
- No code files.

- [ ] **Step 1: Start dev server**

Run:

```bash
npm run dev
```

Expected: local app starts.

- [ ] **Step 2: Run Stripe webhook forwarding**

Run in another terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Expected: Stripe CLI prints a `whsec_...` secret. Put that in `.env.local` or `.env` as `STRIPE_WEBHOOK_SECRET`, then restart the dev server.

- [ ] **Step 3: Test subscription checkout**

Steps:
1. Visit `/zh/pricing`.
2. Click a subscription plan.
3. Pay with Stripe test card `4242 4242 4242 4242`.
4. Return to `/zh/pricing?checkout=success`.
5. Visit `/zh/billing`.

Expected:
- Current plan shows selected tier and interval.
- Current credits increased.
- Credit history contains `subscription_grant`.
- Billing history contains invoice paid event after webhook arrives.

- [ ] **Step 4: Test Customer Portal**

Steps:
1. Visit `/zh/billing`.
2. Click “管理订阅”.

Expected:
- Redirects to Stripe Customer Portal.
- User can update payment method and cancel subscription.
- Returning from portal lands back on `/zh/billing`.

- [ ] **Step 5: Test payment failure webhook**

Use Stripe CLI to trigger:

```bash
stripe trigger invoice.payment_failed
```

Expected:
- Webhook returns 200.
- A billing event is recorded if the event can be mapped to a local subscription.
- Subscription status shows `Payment failed` when mapped.

- [ ] **Step 6: Test refund event recording**

Use Stripe Dashboard sandbox to refund a successful invoice/payment, or trigger:

```bash
stripe trigger charge.refunded
```

Expected:
- Webhook returns 200.
- Refund event is recorded when user can be resolved.
- Credits are not automatically deducted.

---

## Deployment Checklist

- [ ] Configure Stripe Customer Portal in sandbox.
- [ ] Configure Stripe Customer Portal in production before live billing.
- [ ] Add live mode Stripe price IDs in `src/config/pricing.ts`.
- [ ] Set Vercel env vars:
  - `ENABLE_PAID_CREDITS=true`
  - `STRIPE_PRICE_ENV=production`
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
  - `NEXT_PUBLIC_APP_URL=https://image-easy.com`
  - `CRON_SECRET=...`
- [ ] Add Stripe webhook endpoint:
  - `https://image-easy.com/api/stripe/webhook`
- [ ] Subscribe webhook endpoint to:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `charge.refunded`
  - `refund.created`
- [ ] Configure Vercel Cron for `/api/cron/subscription-credits`.
- [ ] Run:

```bash
npm run lint
node --test tests/billing-events.test.mjs tests/billing-overview.test.mjs tests/subscription-credit-grants.test.mjs tests/subscription-plans.test.mjs
```

---

## Review Notes

- This plan uses `BillingEvent` for user-visible payment history. It does not replace `StripeWebhookEvent`, which remains the idempotency ledger for webhook processing.
- This plan uses `CreditTransaction` for credit usage history. No duplicate credit ledger is introduced.
- Refund behavior is conservative: record the refund and leave credit clawback for a later explicit policy.
- The `/billing` page is private and should not be added to sitemap.

