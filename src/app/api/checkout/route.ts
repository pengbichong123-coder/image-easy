import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  priceId: z.string().min(1),
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

  try {
    const stripe = getStripeClient();
    const appUrl = getAppUrl();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: creditPackage.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/pricing?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancel`,
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        creditPackageId: creditPackage.id,
        credits: String(creditPackage.credits),
      },
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe checkout session did not include a redirect URL");
    }

    await prisma.payment.create({
      data: {
        userId: session.user.id,
        stripeCheckoutSessionId: checkoutSession.id,
        amountCents: creditPackage.priceCents,
        currency: creditPackage.currency.toLowerCase(),
        credits: creditPackage.credits,
        status: "pending",
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout creation failed", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
