import { prisma } from "@/lib/db";

const ACTIVE_ACCOUNT_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
];

export async function getAccountSummary(userId: string) {
  const [user, subscription] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true },
    }),
    prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_ACCOUNT_SUBSCRIPTION_STATUSES },
      },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        tier: true,
        interval: true,
        status: true,
      },
    }),
  ]);

  return {
    credits: user.credits,
    planTier: subscription?.tier ?? null,
    planInterval: subscription?.interval ?? null,
    planStatus: subscription?.status ?? null,
  };
}
