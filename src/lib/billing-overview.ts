import { prisma } from "@/lib/db";

const CURRENT_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
];

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
  const [user, currentSubscription, fallbackSubscription, creditTransactions, billingEvents] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true },
    }),
    prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: CURRENT_SUBSCRIPTION_STATUSES },
      },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
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
    prisma.userSubscription.findFirst({
      where: { userId },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
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
    subscription: currentSubscription ?? fallbackSubscription,
    creditTransactions,
    billingEvents,
  };
}
