import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { buildCheckoutReturnUrls } from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function getReturnUrl(req: NextRequest, locale?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = configured && configured.length > 0 ? configured : req.nextUrl.origin;
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
