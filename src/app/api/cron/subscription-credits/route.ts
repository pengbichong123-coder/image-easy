import { NextRequest, NextResponse } from "next/server";
import { grantSubscriptionCreditsInTransaction } from "@/lib/credits";
import { prisma } from "@/lib/db";
import {
  buildMonthlySubscriptionGrantKey,
  nextMonthlyCreditGrantAt,
} from "@/lib/subscription-credit-grants";

export const runtime = "nodejs";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");

  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function shouldContinueAnnualGrants(nextGrantAt: Date, currentPeriodEnd: Date | null) {
  return !currentPeriodEnd || nextGrantAt < currentPeriodEnd;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueSubscriptions = await prisma.userSubscription.findMany({
    where: {
      interval: "year",
      status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
      nextCreditGrantAt: { lte: now },
    },
    select: {
      id: true,
      userId: true,
      stripeSubscriptionId: true,
      monthlyCredits: true,
      nextCreditGrantAt: true,
      currentPeriodEnd: true,
    },
    take: 100,
  });

  let granted = 0;
  let skipped = 0;

  for (const subscription of dueSubscriptions) {
    if (!subscription.nextCreditGrantAt) {
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const freshSubscription = await tx.userSubscription.findFirst({
        where: {
          id: subscription.id,
          interval: "year",
          status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
          nextCreditGrantAt: { lte: now },
        },
        select: {
          id: true,
          userId: true,
          stripeSubscriptionId: true,
          monthlyCredits: true,
          nextCreditGrantAt: true,
          currentPeriodEnd: true,
        },
      });

      if (!freshSubscription?.nextCreditGrantAt) {
        skipped += 1;
        return;
      }

      if (!shouldContinueAnnualGrants(freshSubscription.nextCreditGrantAt, freshSubscription.currentPeriodEnd)) {
        await tx.userSubscription.update({
          where: { id: freshSubscription.id },
          data: { nextCreditGrantAt: null },
        });
        skipped += 1;
        return;
      }

      const grant = await grantSubscriptionCreditsInTransaction(tx, {
        userId: freshSubscription.userId,
        subscriptionId: freshSubscription.id,
        grantKey: buildMonthlySubscriptionGrantKey(
          freshSubscription.stripeSubscriptionId,
          freshSubscription.nextCreditGrantAt,
        ),
        amount: freshSubscription.monthlyCredits,
        reason: "Grant monthly credits for annual subscription",
      });

      const nextGrantAt = nextMonthlyCreditGrantAt(freshSubscription.nextCreditGrantAt);
      await tx.userSubscription.update({
        where: { id: freshSubscription.id },
        data: {
          lastCreditGrantAt: grant.granted ? freshSubscription.nextCreditGrantAt : undefined,
          nextCreditGrantAt: shouldContinueAnnualGrants(nextGrantAt, freshSubscription.currentPeriodEnd)
            ? nextGrantAt
            : null,
        },
      });

      if (grant.granted) {
        granted += 1;
      } else {
        skipped += 1;
      }
    });
  }

  return NextResponse.json({
    checked: dueSubscriptions.length,
    granted,
    skipped,
  });
}
