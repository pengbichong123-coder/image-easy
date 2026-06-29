import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { grantPurchasedCreditsInTransaction, grantSubscriptionCreditsInTransaction } from "@/lib/credits";
import {
  billingEventLabel,
  stripeAmountToCents,
  stripeCurrency,
  type BillingEventStatus,
  type BillingEventType,
} from "@/lib/billing-events";
import { prisma } from "@/lib/db";
import { buildStripeInvoiceGrantKey } from "@/lib/subscription-credit-grants";
import {
  findSubscriptionPlanById,
  findSubscriptionPlanByStripePriceId,
  getSubscriptionPlanPeriodCredits,
  type SubscriptionPlan,
} from "@/lib/subscription-plans";
import {
  type CheckoutPaymentForValidation,
  validateCheckoutSessionAgainstPayment,
  validateCheckoutSessionPaymentDetails,
} from "@/lib/stripe-checkout";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

function stripePaymentIntentId(session: Stripe.Checkout.Session) {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) {
    return null;
  }

  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function stripeObjectId(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function stripeDate(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function checkoutMetadata(session: Stripe.Checkout.Session) {
  return session.metadata ?? {};
}

function invoiceMetadata(invoice: Stripe.Invoice) {
  const rawInvoice = invoice as Stripe.Invoice & {
    subscription_details?: { metadata?: Stripe.Metadata | null } | null;
  };

  return {
    ...(rawInvoice.subscription_details?.metadata ?? {}),
    ...(invoice.metadata ?? {}),
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const rawInvoice = invoice as Stripe.Invoice & {
    parent?: {
      subscription_details?: {
        subscription?: unknown;
      } | null;
    } | null;
    subscription?: unknown;
  };

  return stripeObjectId(rawInvoice.subscription ?? rawInvoice.parent?.subscription_details?.subscription);
}

function invoiceCustomerId(invoice: Stripe.Invoice) {
  const rawInvoice = invoice as Stripe.Invoice & {
    customer?: unknown;
    parent?: {
      subscription_details?: {
        subscription?: { customer?: unknown } | string | null;
      } | null;
    } | null;
  };

  const parentSubscription = rawInvoice.parent?.subscription_details?.subscription;
  const parentCustomer = typeof parentSubscription === "object" ? parentSubscription?.customer : null;

  return stripeObjectId(rawInvoice.customer ?? parentCustomer);
}

function invoicePrimaryPriceId(invoice: Stripe.Invoice) {
  const line = invoice.lines.data[0] as Stripe.InvoiceLineItem & {
    price?: { id?: string | null } | null;
    pricing?: { price_details?: { price?: string | null } | null } | null;
  };

  return line.price?.id ?? line.pricing?.price_details?.price ?? null;
}

function invoicePeriodStart(invoice: Stripe.Invoice) {
  return stripeDate(invoice.lines.data[0]?.period?.start) ?? stripeDate(invoice.created) ?? new Date();
}

function invoicePeriodEnd(invoice: Stripe.Invoice) {
  return stripeDate(invoice.lines.data[0]?.period?.end);
}

function invoicePaymentIntentId(invoice: Stripe.Invoice) {
  return stripeObjectId((invoice as Stripe.Invoice & { payment_intent?: unknown }).payment_intent);
}

function invoiceChargeId(invoice: Stripe.Invoice) {
  return stripeObjectId((invoice as Stripe.Invoice & { charge?: unknown }).charge);
}

function invoiceAmount(invoice: Stripe.Invoice, kind: "paid" | "due") {
  const rawInvoice = invoice as Stripe.Invoice & {
    amount_paid?: number | null;
    amount_due?: number | null;
  };

  return stripeAmountToCents(kind === "paid" ? rawInvoice.amount_paid : rawInvoice.amount_due);
}

function subscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id ?? null;
}

function subscriptionPeriodStart(subscription: Stripe.Subscription) {
  const rawSubscription = subscription as Stripe.Subscription & {
    current_period_start?: number;
    items?: { data?: Array<{ current_period_start?: number | null }> };
  };

  return stripeDate(rawSubscription.current_period_start)
    ?? stripeDate(rawSubscription.items?.data?.[0]?.current_period_start);
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const rawSubscription = subscription as Stripe.Subscription & {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number | null }> };
  };

  return stripeDate(rawSubscription.current_period_end)
    ?? stripeDate(rawSubscription.items?.data?.[0]?.current_period_end);
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function buildPaymentIntentUpdate(session: Stripe.Checkout.Session) {
  const paymentIntentId = stripePaymentIntentId(session);

  return paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {};
}

async function recordBillingEvent(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    subscriptionId?: string | null;
    stripeEventId: string;
    stripeInvoiceId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
    stripeRefundId?: string | null;
    type: BillingEventType;
    status: BillingEventStatus;
    amountCents?: number | null;
    currency?: string | null;
    description?: string | null;
    hostedInvoiceUrl?: string | null;
    invoicePdf?: string | null;
    occurredAt: Date;
    metadata?: Record<string, string | number | boolean | null | undefined>;
  },
) {
  await tx.billingEvent.createMany({
    data: {
      userId: input.userId,
      subscriptionId: input.subscriptionId ?? null,
      stripeEventId: input.stripeEventId,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripeChargeId: input.stripeChargeId ?? null,
      stripeRefundId: input.stripeRefundId ?? null,
      type: input.type,
      status: input.status,
      amountCents: input.amountCents ?? null,
      currency: stripeCurrency(input.currency),
      description: input.description ?? billingEventLabel(input.type),
      hostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
      invoicePdf: input.invoicePdf ?? null,
      occurredAt: input.occurredAt,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    skipDuplicates: true,
  });
}

async function recordInvoiceBillingEvent(
  tx: Prisma.TransactionClient,
  input: {
    eventId: string;
    invoice: Stripe.Invoice;
    subscriptionId?: string | null;
    userId: string;
    type: Extract<BillingEventType, "invoice_paid" | "invoice_payment_failed">;
    status: Extract<BillingEventStatus, "paid" | "failed">;
    amountKind: "paid" | "due";
  },
) {
  await recordBillingEvent(tx, {
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    stripeEventId: input.eventId,
    stripeInvoiceId: input.invoice.id,
    stripePaymentIntentId: invoicePaymentIntentId(input.invoice),
    stripeChargeId: invoiceChargeId(input.invoice),
    type: input.type,
    status: input.status,
    amountCents: invoiceAmount(input.invoice, input.amountKind),
    currency: input.invoice.currency,
    description: billingEventLabel(input.type),
    hostedInvoiceUrl: input.invoice.hosted_invoice_url,
    invoicePdf: input.invoice.invoice_pdf,
    occurredAt: stripeDate(input.invoice.created) ?? new Date(),
  });
}

async function findCheckoutPayment(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session,
): Promise<CheckoutPaymentForValidation> {
  const paymentBySessionId = await tx.payment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: {
      id: true,
      userId: true,
      stripeCheckoutSessionId: true,
      credits: true,
      amountCents: true,
      currency: true,
      status: true,
    },
  });

  if (paymentBySessionId) {
    return paymentBySessionId;
  }

  const metadataPaymentId = session.metadata?.paymentId;
  if (!metadataPaymentId) {
    throw new Error(`Local payment not found and Stripe checkout session ${session.id} has no metadata paymentId`);
  }

  const payment = await tx.payment.findFirst({
    where: {
      id: metadataPaymentId,
      userId: session.metadata?.userId,
    },
    select: {
      id: true,
      userId: true,
      stripeCheckoutSessionId: true,
      credits: true,
      amountCents: true,
      currency: true,
      status: true,
    },
  });

  if (!payment) {
    throw new Error(`Local payment not found for Stripe checkout session ${session.id}`);
  }

  return payment;
}

async function attachCheckoutSessionIdIfMissing(
  tx: Prisma.TransactionClient,
  payment: CheckoutPaymentForValidation,
  session: Stripe.Checkout.Session,
) {
  if (payment.stripeCheckoutSessionId === session.id) {
    return;
  }

  if (payment.stripeCheckoutSessionId) {
    throw new Error("Local payment is already linked to a different Stripe checkout session");
  }

  const attached = await tx.payment.updateMany({
    where: {
      id: payment.id,
      stripeCheckoutSessionId: null,
    },
    data: {
      stripeCheckoutSessionId: session.id,
    },
  });

  if (attached.count !== 1) {
    throw new Error(`Failed to attach Stripe checkout session ${session.id} to payment ${payment.id}`);
  }

  payment.stripeCheckoutSessionId = session.id;
}

async function markCheckoutSessionPayment(
  tx: Prisma.TransactionClient,
  input: {
    payment: CheckoutPaymentForValidation;
    session: Stripe.Checkout.Session;
    status: "canceled" | "failed";
  },
) {
  await attachCheckoutSessionIdIfMissing(tx, input.payment, input.session);

  await tx.payment.updateMany({
    where: {
      id: input.payment.id,
      status: "pending",
    },
    data: {
      status: input.status,
      ...buildPaymentIntentUpdate(input.session),
    },
  });
}

async function processCheckoutSessionPaid(tx: Prisma.TransactionClient, session: Stripe.Checkout.Session) {
  const payment = await findCheckoutPayment(tx, session);
  validateCheckoutSessionAgainstPayment(session, payment);
  await attachCheckoutSessionIdIfMissing(tx, payment, session);

  if (payment.status === "paid") {
    await grantPurchasedCreditsInTransaction(tx, {
      userId: payment.userId,
      paymentId: payment.id,
      amount: payment.credits,
      reason: "Purchase credits via Stripe",
    });
    return;
  }

  if (payment.status !== "pending") {
    throw new Error(`Refusing to grant credits for ${payment.status} payment ${payment.id}`);
  }

  const paid = await tx.payment.updateMany({
    where: {
      id: payment.id,
      status: "pending",
    },
    data: {
      status: "paid",
      ...buildPaymentIntentUpdate(session),
    },
  });

  if (paid.count !== 1) {
    throw new Error(`Failed to mark payment ${payment.id} as paid`);
  }

  await grantPurchasedCreditsInTransaction(tx, {
    userId: payment.userId,
    paymentId: payment.id,
    amount: payment.credits,
    reason: "Purchase credits via Stripe",
  });
}

async function upsertUserSubscription(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string | null;
    stripeCheckoutSessionId?: string | null;
    plan: SubscriptionPlan;
    status: string;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  },
) {
  return tx.userSubscription.upsert({
    where: { stripeSubscriptionId: input.stripeSubscriptionId },
    create: {
      userId: input.userId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeCustomerId: input.stripeCustomerId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePriceId: input.plan.stripePriceId!,
      planId: input.plan.id,
      tier: input.plan.tier,
      interval: input.plan.interval,
      status: input.status,
      monthlyCredits: input.plan.monthlyCredits,
      currency: input.plan.currency,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
    },
    update: {
      stripeCustomerId: input.stripeCustomerId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePriceId: input.plan.stripePriceId!,
      planId: input.plan.id,
      tier: input.plan.tier,
      interval: input.plan.interval,
      status: input.status,
      monthlyCredits: input.plan.monthlyCredits,
      currency: input.plan.currency,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
    },
  });
}

async function grantSubscriptionPeriodCredits(
  tx: Prisma.TransactionClient,
  input: {
    subscriptionId: string;
    userId: string;
    plan: SubscriptionPlan;
    grantKey: string;
    grantAt: Date;
    reason: string;
  },
) {
  const grant = await grantSubscriptionCreditsInTransaction(tx, {
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    grantKey: input.grantKey,
    amount: getSubscriptionPlanPeriodCredits(input.plan),
    reason: input.reason,
  });

  if (grant.granted) {
    await tx.userSubscription.update({
      where: { id: input.subscriptionId },
      data: {
        lastCreditGrantAt: input.grantAt,
        nextCreditGrantAt: null,
      },
    });
  }
}

async function processSubscriptionCheckoutCompleted(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session,
  eventId: string,
) {
  const metadata = checkoutMetadata(session);
  const planId = metadata.planId;
  const userId = metadata.userId;
  const stripeSubscriptionId = stripeObjectId(session.subscription);
  if (!planId || !userId || !stripeSubscriptionId) {
    throw new Error(`Subscription checkout session ${session.id} is missing required metadata`);
  }

  const plan = findSubscriptionPlanById(planId);
  if (!plan.stripePriceId) {
    throw new Error(`Subscription plan ${plan.id} is missing Stripe price id`);
  }

  const subscription = await upsertUserSubscription(tx, {
    userId,
    stripeSubscriptionId,
    stripeCustomerId: stripeObjectId(session.customer),
    stripeCheckoutSessionId: session.id,
    plan,
    status: session.payment_status === "paid" ? "active" : "incomplete",
  });

  await recordBillingEvent(tx, {
    userId,
    subscriptionId: subscription.id,
    stripeEventId: eventId,
    stripeInvoiceId: stripeObjectId(session.invoice),
    type: "checkout_completed",
    status: session.payment_status === "paid" ? "paid" : "informational",
    amountCents: stripeAmountToCents(session.amount_total),
    currency: session.currency,
    description: billingEventLabel("checkout_completed"),
    occurredAt: stripeDate(session.created) ?? new Date(),
    metadata: {
      checkoutSessionId: session.id,
      paymentStatus: session.payment_status,
      planId,
    },
  });

  const invoiceId = stripeObjectId(session.invoice);
  if (session.payment_status === "paid" && invoiceId) {
    const grantAt = stripeDate(session.created) ?? new Date();
    await grantSubscriptionPeriodCredits(tx, {
      subscriptionId: subscription.id,
      userId,
      plan,
      grantKey: buildStripeInvoiceGrantKey(invoiceId),
      grantAt,
      reason: "Grant subscription credits after Stripe checkout completed",
    });
  }
}

async function processInvoicePaid(tx: Prisma.TransactionClient, invoice: Stripe.Invoice, eventId: string) {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  const stripePriceId = invoicePrimaryPriceId(invoice);
  if (!stripeSubscriptionId || !stripePriceId) {
    return;
  }

  const plan = findSubscriptionPlanByStripePriceId(stripePriceId);
  const metadata = invoiceMetadata(invoice);
  let subscription = await tx.userSubscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    if (!metadata.userId) {
      throw new Error(`Cannot create local subscription for invoice ${invoice.id} without userId metadata`);
    }
    subscription = await upsertUserSubscription(tx, {
      userId: metadata.userId,
      stripeSubscriptionId,
      stripeCustomerId: invoiceCustomerId(invoice),
      plan,
      status: "active",
      currentPeriodStart: invoicePeriodStart(invoice),
      currentPeriodEnd: invoicePeriodEnd(invoice),
    });
  } else {
    subscription = await upsertUserSubscription(tx, {
      userId: subscription.userId,
      stripeSubscriptionId,
      stripeCustomerId: invoiceCustomerId(invoice) ?? subscription.stripeCustomerId,
      plan,
      status: "active",
      currentPeriodStart: invoicePeriodStart(invoice),
      currentPeriodEnd: invoicePeriodEnd(invoice),
    });
  }

  await grantSubscriptionPeriodCredits(tx, {
    subscriptionId: subscription.id,
    userId: subscription.userId,
    plan,
    grantKey: buildStripeInvoiceGrantKey(invoice.id),
    grantAt: invoicePeriodStart(invoice),
    reason: "Grant subscription credits after Stripe invoice paid",
  });

  await recordInvoiceBillingEvent(tx, {
    eventId,
    invoice,
    subscriptionId: subscription.id,
    userId: subscription.userId,
    type: "invoice_paid",
    status: "paid",
    amountKind: "paid",
  });
}

async function processInvoicePaymentFailed(tx: Prisma.TransactionClient, invoice: Stripe.Invoice, eventId: string) {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return;

  const existing = await tx.userSubscription.findUnique({
    where: { stripeSubscriptionId },
  });
  const metadata = invoiceMetadata(invoice);
  const userId = existing?.userId ?? metadata.userId;
  if (!userId) return;

  let subscriptionId = existing?.id ?? null;
  if (existing) {
    const updated = await tx.userSubscription.update({
      where: { id: existing.id },
      data: {
        status: "past_due",
        currentPeriodStart: invoicePeriodStart(invoice),
        currentPeriodEnd: invoicePeriodEnd(invoice),
      },
      select: { id: true },
    });
    subscriptionId = updated.id;
  }

  await recordInvoiceBillingEvent(tx, {
    eventId,
    invoice,
    subscriptionId,
    userId,
    type: "invoice_payment_failed",
    status: "failed",
    amountKind: "due",
  });
}

async function processSubscriptionStatusUpdate(tx: Prisma.TransactionClient, subscription: Stripe.Subscription) {
  const stripePriceId = subscriptionPriceId(subscription);
  if (!stripePriceId) return;

  const plan = findSubscriptionPlanByStripePriceId(stripePriceId);
  const existing = await tx.userSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  const metadata = subscription.metadata ?? {};
  const userId = existing?.userId ?? metadata.userId;
  if (!userId) return;

  await upsertUserSubscription(tx, {
    userId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: stripeObjectId(subscription.customer),
    plan,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: subscriptionPeriodStart(subscription),
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
  });
}

async function processCheckoutSessionCompleted(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session,
  eventId: string,
) {
  if (session.mode === "subscription") {
    await processSubscriptionCheckoutCompleted(tx, session, eventId);
    return;
  }

  const payment = await findCheckoutPayment(tx, session);

  if (session.payment_status !== "paid") {
    validateCheckoutSessionPaymentDetails(session, payment);
    await attachCheckoutSessionIdIfMissing(tx, payment, session);
    await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: "pending",
      },
      data: buildPaymentIntentUpdate(session),
    });
    return;
  }

  await processCheckoutSessionPaid(tx, session);

  await recordBillingEvent(tx, {
    userId: payment.userId,
    stripeEventId: eventId,
    stripePaymentIntentId: stripePaymentIntentId(session),
    type: "checkout_completed",
    status: "paid",
    amountCents: stripeAmountToCents(session.amount_total),
    currency: session.currency,
    description: billingEventLabel("checkout_completed"),
    occurredAt: stripeDate(session.created) ?? new Date(),
    metadata: {
      checkoutSessionId: session.id,
      paymentId: payment.id,
    },
  });
}

async function processCheckoutSessionTerminalFailure(
  tx: Prisma.TransactionClient,
  input: {
    session: Stripe.Checkout.Session;
    status: "canceled" | "failed";
  },
) {
  const payment = await findCheckoutPayment(tx, input.session);
  validateCheckoutSessionPaymentDetails(input.session, payment);
  await markCheckoutSessionPayment(tx, {
    ...input,
    payment,
  });
}

async function findBillingEventUserByStripeRefs(
  tx: Prisma.TransactionClient,
  input: {
    stripePaymentIntentId?: string | null;
    stripeInvoiceId?: string | null;
    stripeChargeId?: string | null;
  },
) {
  if (input.stripePaymentIntentId) {
    const payment = await tx.payment.findUnique({
      where: { stripePaymentIntentId: input.stripePaymentIntentId },
      select: { userId: true },
    });
    if (payment) return payment.userId;
  }

  const event = await tx.billingEvent.findFirst({
    where: {
      OR: [
        input.stripePaymentIntentId ? { stripePaymentIntentId: input.stripePaymentIntentId } : undefined,
        input.stripeInvoiceId ? { stripeInvoiceId: input.stripeInvoiceId } : undefined,
        input.stripeChargeId ? { stripeChargeId: input.stripeChargeId } : undefined,
      ].filter(Boolean) as Prisma.BillingEventWhereInput[],
    },
    select: { userId: true },
    orderBy: { occurredAt: "desc" },
  });

  return event?.userId ?? null;
}

async function processChargeRefunded(tx: Prisma.TransactionClient, charge: Stripe.Charge, eventId: string) {
  const stripePaymentIntentId = stripeObjectId(charge.payment_intent);
  const stripeInvoiceId = stripeObjectId((charge as Stripe.Charge & { invoice?: unknown }).invoice);
  const stripeChargeId = charge.id;
  const userId = await findBillingEventUserByStripeRefs(tx, {
    stripePaymentIntentId,
    stripeInvoiceId,
    stripeChargeId,
  });

  if (!userId) return;

  const refund = charge.refunds?.data?.[0];
  await recordBillingEvent(tx, {
    userId,
    stripeEventId: eventId,
    stripeInvoiceId,
    stripePaymentIntentId,
    stripeChargeId,
    stripeRefundId: refund?.id ?? null,
    type: "refund_created",
    status: "refunded",
    amountCents: stripeAmountToCents(charge.amount_refunded),
    currency: charge.currency,
    description: billingEventLabel("refund_created"),
    occurredAt: refund ? (stripeDate(refund.created) ?? new Date()) : new Date(),
    metadata: {
      source: "charge.refunded",
      chargeId: charge.id,
    },
  });
}

async function processRefundCreated(tx: Prisma.TransactionClient, refund: Stripe.Refund, eventId: string) {
  const stripePaymentIntentId = stripeObjectId(refund.payment_intent);
  const stripeChargeId = stripeObjectId(refund.charge);
  const userId = await findBillingEventUserByStripeRefs(tx, {
    stripePaymentIntentId,
    stripeChargeId,
  });

  if (!userId) return;

  await recordBillingEvent(tx, {
    userId,
    stripeEventId: eventId,
    stripePaymentIntentId,
    stripeChargeId,
    stripeRefundId: refund.id,
    type: "refund_created",
    status: "refunded",
    amountCents: stripeAmountToCents(refund.amount),
    currency: refund.currency,
    description: billingEventLabel("refund_created"),
    occurredAt: stripeDate(refund.created) ?? new Date(),
    metadata: {
      source: "refund.created",
      reason: refund.reason,
    },
  });
}

async function stripeWebhookEventExists(eventId: string) {
  const existingEvent = await prisma.stripeWebhookEvent.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  return Boolean(existingEvent);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let stripe;
  let webhookSecret;
  try {
    stripe = getStripeClient();
    webhookSecret = getStripeWebhookSecret();
  } catch (error) {
    console.error("Stripe webhook configuration failed", error);
    return NextResponse.json({ error: "Webhook configuration failed" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid Stripe webhook" }, { status: 400 });
  }

  if (await stripeWebhookEventExists(event.id)) {
    return NextResponse.json({ received: true });
  }

  try {
    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.stripeWebhookEvent.create({
          data: {
            id: event.id,
            type: event.type,
          },
        });

        await processCheckoutSessionTerminalFailure(tx, {
          session: event.data.object as Stripe.Checkout.Session,
          status: event.type === "checkout.session.expired" ? "canceled" : "failed",
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.stripeWebhookEvent.create({
          data: {
            id: event.id,
            type: event.type,
          },
        });

        if (
          event.type === "checkout.session.completed" ||
          event.type === "checkout.session.async_payment_succeeded"
        ) {
          await processCheckoutSessionCompleted(tx, event.data.object as Stripe.Checkout.Session, event.id);
        } else if (
          event.type === "invoice.paid" ||
          event.type === "invoice.payment_succeeded"
        ) {
          await processInvoicePaid(tx, event.data.object as Stripe.Invoice, event.id);
        } else if (event.type === "invoice.payment_failed") {
          await processInvoicePaymentFailed(tx, event.data.object as Stripe.Invoice, event.id);
        } else if (
          event.type === "customer.subscription.updated" ||
          event.type === "customer.subscription.deleted"
        ) {
          await processSubscriptionStatusUpdate(tx, event.data.object as Stripe.Subscription);
        } else if (event.type === "charge.refunded") {
          await processChargeRefunded(tx, event.data.object as Stripe.Charge, event.id);
        } else if (event.type === "refund.created") {
          await processRefundCreated(tx, event.data.object as Stripe.Refund, event.id);
        }
      });
    }
  } catch (error) {
    if (isUniqueConstraintError(error) && await stripeWebhookEventExists(event.id)) {
      return NextResponse.json({ received: true });
    }

    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
