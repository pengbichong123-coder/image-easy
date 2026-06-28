import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { grantPurchasedCreditsInTransaction } from "@/lib/credits";
import { prisma } from "@/lib/db";
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
      status: { notIn: ["paid", input.status] },
    },
    data: {
      status: input.status,
      stripePaymentIntentId: stripePaymentIntentId(input.session) ?? undefined,
    },
  });
}

async function processCheckoutSessionCompleted(tx: Prisma.TransactionClient, session: Stripe.Checkout.Session) {
  const paymentIntentId = stripePaymentIntentId(session);
  const paymentByCheckoutSession = await tx.payment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: {
      id: true,
      userId: true,
      credits: true,
    },
  });
  const payment = paymentByCheckoutSession ?? (
    paymentIntentId
      ? await tx.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        select: {
          id: true,
          userId: true,
          credits: true,
        },
      })
      : null
  );

  if (!payment) {
    return;
  }

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "paid",
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
  });

  await grantPurchasedCreditsInTransaction(tx, {
    userId: payment.userId,
    paymentId: payment.id,
    amount: payment.credits,
    reason: "Purchase credits via Stripe",
  });
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

  const existingEvent = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
    select: { id: true },
  });

  if (existingEvent) {
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

        await markCheckoutSessionPayment(tx, {
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

        if (event.type === "checkout.session.completed") {
          await processCheckoutSessionCompleted(tx, event.data.object as Stripe.Checkout.Session);
        }
      });
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ received: true });
    }

    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
