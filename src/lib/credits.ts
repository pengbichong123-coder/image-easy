import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type TransactionClient = Prisma.TransactionClient;

type CreditInput = {
  userId: string;
  amount: number;
  reason: string;
};

type GenerationCreditInput = CreditInput & {
  generationId: string;
};

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Not enough credits");
    this.name = "InsufficientCreditsError";
  }
}

function normalizeAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer");
  }

  return amount;
}

async function currentBalance(tx: TransactionClient, userId: string) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true },
  });

  return user.credits;
}

export async function reserveGenerationCredit(input: CreditInput): Promise<{ balanceAfter: number }> {
  const amount = normalizeAmount(input.amount);

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.user.updateMany({
      where: {
        id: input.userId,
        credits: { gte: amount },
      },
      data: {
        credits: { decrement: amount },
      },
    });

    if (reservation.count !== 1) {
      throw new InsufficientCreditsError();
    }

    const balanceAfter = await currentBalance(tx, input.userId);

    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: "reserve",
        amount: -amount,
        balanceAfter,
        reason: input.reason,
      },
    });

    return { balanceAfter };
  });
}

export async function consumeReservedCreditInTransaction(
  tx: TransactionClient,
  input: GenerationCreditInput,
): Promise<void> {
  const amount = normalizeAmount(input.amount);
  const existing = await tx.creditTransaction.findFirst({
    where: {
      generationId: input.generationId,
      type: "consume",
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  const balanceAfter = await currentBalance(tx, input.userId);

  await tx.creditTransaction.create({
    data: {
      userId: input.userId,
      generationId: input.generationId,
      type: "consume",
      amount: 0,
      balanceAfter,
      reason: input.reason,
      metadata: JSON.stringify({ reservedAmount: amount }),
    },
  });
}

export async function consumeReservedCredit(input: GenerationCreditInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await consumeReservedCreditInTransaction(tx, input);
  });
}

export async function refundGenerationCreditInTransaction(
  tx: TransactionClient,
  input: GenerationCreditInput,
): Promise<void> {
  const amount = normalizeAmount(input.amount);
  const existing = await tx.creditTransaction.findFirst({
    where: {
      generationId: input.generationId,
      type: "refund",
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  const user = await tx.user.update({
    where: { id: input.userId },
    data: { credits: { increment: amount } },
    select: { credits: true },
  });

  await tx.creditTransaction.create({
    data: {
      userId: input.userId,
      generationId: input.generationId,
      type: "refund",
      amount,
      balanceAfter: user.credits,
      reason: input.reason,
    },
  });
}

export async function refundGenerationCredit(input: GenerationCreditInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await refundGenerationCreditInTransaction(tx, input);
  });
}

export async function refundReservedCreditWithoutGeneration(input: CreditInput): Promise<void> {
  const amount = normalizeAmount(input.amount);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: input.userId },
      data: { credits: { increment: amount } },
      select: { credits: true },
    });

    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: "refund",
        amount,
        balanceAfter: user.credits,
        reason: input.reason,
        metadata: JSON.stringify({ generationId: null }),
      },
    });
  });
}
