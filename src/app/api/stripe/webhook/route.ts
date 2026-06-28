import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { grantPurchasedCreditsInTransaction } from "@/lib/credits";
import { prisma } from "@/lib/db";
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
  const payment = await tx.payment.findUnique({
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

  if (!payment) {
    throw new Error(`Local payment not found for Stripe checkout session ${session.id}`);
  }

  return payment;
}

async function markCheckoutSessionPayment(
  tx: Prisma.TransactionClient,
  input: {
    session: Stripe.Checkout.Session;
    status: "canceled" | "failed";
  },
) {
  await tx.payment.updateMany({
    where: {
      stripeCheckoutSessionId: input.session.id,
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

async function processCheckoutSessionCompleted(tx: Prisma.TransactionClient, session: Stripe.Checkout.Session) {
  const payment = await findCheckoutPayment(tx, session);

  if (session.payment_status !== "paid") {
    validateCheckoutSessionPaymentDetails(session, payment);
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
  await markCheckoutSessionPayment(tx, input);
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
