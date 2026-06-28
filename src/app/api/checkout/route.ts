import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCheckoutReturnUrls } from "@/lib/stripe-checkout";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  priceId: z.string().min(1),
  locale: z.string().optional(),
});

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL environment variable");
  }

  return appUrl.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
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
    const stripe = getStripeClient();
    const { successUrl, cancelUrl } = buildCheckoutReturnUrls(getAppUrl(), body.locale);
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
