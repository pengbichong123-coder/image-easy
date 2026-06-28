import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { grantPurchasedCreditsInTransaction, grantSubscriptionCreditsInTransaction } from "@/lib/credits";
import { prisma } from "@/lib/db";
import {
  buildStripeInvoiceGrantKey,
  nextMonthlyCreditGrantAt,
} from "@/lib/subscription-credit-grants";
import {
  findSubscriptionPlanById,
  findSubscriptionPlanByStripePriceId,
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
  return stripeObjectId((invoice as Stripe.Invoice & { subscription?: unknown }).subscription);
}

function invoiceCustomerId(invoice: Stripe.Invoice) {
  return stripeObjectId(invoice.customer);
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

function subscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id ?? null;
}

function subscriptionPeriodStart(subscription: Stripe.Subscription) {
  return stripeDate((subscription as Stripe.Subscription & { current_period_start?: number }).current_period_start);
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  return stripeDate((subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end);
}

function nextGrantForPlan(plan: SubscriptionPlan, grantAt: Date, currentPeriodEnd?: Date | null) {
  if (plan.interval !== "year") return null;
  const nextGrantAt = nextMonthlyCreditGrantAt(grantAt);
  if (currentPeriodEnd && nextGrantAt >= currentPeriodEnd) return null;
  return nextGrantAt;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function buildPaymentIntentUpdate(session: Stripe.Checkout.Session) {
  const paymentIntentId = stripePaymentIntentId(session);

  return paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {};
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
    stripeSubscriptionId: string;
    userId: string;
    plan: SubscriptionPlan;
    grantKey: string;
    grantAt: Date;
    currentPeriodEnd?: Date | null;
    reason: string;
  },
) {
  const grant = await grantSubscriptionCreditsInTransaction(tx, {
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    grantKey: input.grantKey,
    amount: input.plan.monthlyCredits,
    reason: input.reason,
  });

  if (grant.granted) {
    await tx.userSubscription.update({
      where: { id: input.subscriptionId },
      data: {
        lastCreditGrantAt: input.grantAt,
        nextCreditGrantAt: nextGrantForPlan(input.plan, input.grantAt, input.currentPeriodEnd),
      },
    });
  }
}

async function processSubscriptionCheckoutCompleted(tx: Prisma.TransactionClient, session: Stripe.Checkout.Session) {
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

  const invoiceId = stripeObjectId(session.invoice);
  if (session.payment_status === "paid" && invoiceId) {
    const grantAt = stripeDate(session.created) ?? new Date();
    await grantSubscriptionPeriodCredits(tx, {
      subscriptionId: subscription.id,
      stripeSubscriptionId,
      userId,
      plan,
      grantKey: buildStripeInvoiceGrantKey(invoiceId),
      grantAt,
      reason: "Grant subscription credits after Stripe checkout completed",
    });
  }
}

async function processInvoicePaid(tx: Prisma.TransactionClient, invoice: Stripe.Invoice) {
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
    stripeSubscriptionId,
    userId: subscription.userId,
    plan,
    grantKey: buildStripeInvoiceGrantKey(invoice.id),
    grantAt: invoicePeriodStart(invoice),
    currentPeriodEnd: invoicePeriodEnd(invoice),
    reason: "Grant subscription credits after Stripe invoice paid",
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

async function processCheckoutSessionCompleted(tx: Prisma.TransactionClient, session: Stripe.Checkout.Session) {
  if (session.mode === "subscription") {
    await processSubscriptionCheckoutCompleted(tx, session);
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
          await processCheckoutSessionCompleted(tx, event.data.object as Stripe.Checkout.Session);
        } else if (event.type === "invoice.paid") {
          await processInvoicePaid(tx, event.data.object as Stripe.Invoice);
        } else if (
          event.type === "customer.subscription.updated" ||
          event.type === "customer.subscription.deleted"
        ) {
          await processSubscriptionStatusUpdate(tx, event.data.object as Stripe.Subscription);
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
