import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCheckoutReturnUrls } from "@/lib/stripe-checkout";
import { getStripeClient } from "@/lib/stripe";
import { isPaidCreditsEnabled } from "@/lib/pricing-mode";
import {
  findSubscriptionPlanByStripePriceId,
  getSubscriptionPlanPeriodCredits,
} from "@/lib/subscription-plans";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  priceId: z.string().min(1),
  locale: z.string().optional(),
});

function getAppUrl(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/$/, "");
  }

  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  if (!isPaidCreditsEnabled(process.env.ENABLE_PAID_CREDITS)) {
    return NextResponse.json({ error: "Paid credits are not available" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof checkoutSchema>;
  try {
    body = checkoutSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: error instanceof z.ZodError ? error.issues : undefined,
      },
      { status: 400 },
    );
  }

  const stripe = getStripeClient();
  const { successUrl, cancelUrl } = buildCheckoutReturnUrls(getAppUrl(req), body.locale);

  try {
    const subscriptionPlan = findSubscriptionPlanByStripePriceId(body.priceId);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: subscriptionPlan.stripePriceId!,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: session.user.id,
      customer_email: session.user.email ?? undefined,
      metadata: {
        userId: session.user.id,
        planId: subscriptionPlan.id,
        tier: subscriptionPlan.tier,
        interval: subscriptionPlan.interval,
        monthlyCredits: String(subscriptionPlan.monthlyCredits),
        periodCredits: String(getSubscriptionPlanPeriodCredits(subscriptionPlan)),
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          planId: subscriptionPlan.id,
          tier: subscriptionPlan.tier,
          interval: subscriptionPlan.interval,
          monthlyCredits: String(subscriptionPlan.monthlyCredits),
          periodCredits: String(getSubscriptionPlanPeriodCredits(subscriptionPlan)),
        },
      },
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe checkout session did not include a redirect URL");
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith("Unknown Stripe subscription price")) {
      console.error("Subscription checkout creation failed", error);
      return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
    }
  }

  const creditPackage = await prisma.creditPackage.findFirst({
    where: {
      stripePriceId: body.priceId,
      active: true,
    },
    select: {
      id: true,
      name: true,
      credits: true,
      priceCents: true,
      currency: true,
      stripePriceId: true,
    },
  });

  if (!creditPackage) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  let payment: { id: string };
  try {
    payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        amountCents: creditPackage.priceCents,
        currency: creditPackage.currency.toLowerCase(),
        credits: creditPackage.credits,
        status: "pending",
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    console.error("Failed to create local payment", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: creditPackage.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: session.user.id,
      metadata: {
        paymentId: payment.id,
        userId: session.user.id,
        creditPackageId: creditPackage.id,
        credits: String(creditPackage.credits),
      },
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe checkout session did not include a redirect URL");
    }

    try {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeCheckoutSessionId: checkoutSession.id,
        },
      });
    } catch (error) {
      console.error("Failed to attach Stripe checkout session to local payment", error);
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: "pending",
        stripeCheckoutSessionId: null,
      },
      data: {
        status: "failed",
      },
    });

    console.error("Checkout creation failed", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
