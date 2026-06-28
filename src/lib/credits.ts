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

export async function reserveGenerationCreditInTransaction(
  tx: TransactionClient,
  input: GenerationCreditInput,
): Promise<{ balanceAfter: number }> {
  const amount = normalizeAmount(input.amount);

  const reservationLedger = await tx.creditTransaction.createMany({
    data: {
      userId: input.userId,
      generationId: input.generationId,
      type: "reserve",
      amount: -amount,
      balanceAfter: 0,
      reason: input.reason,
    },
    skipDuplicates: true,
  });

  if (reservationLedger.count !== 1) {
    return { balanceAfter: await currentBalance(tx, input.userId) };
  }

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

  await tx.creditTransaction.updateMany({
    where: {
      userId: input.userId,
      generationId: input.generationId,
      type: "reserve",
    },
    data: { balanceAfter },
  });

  return { balanceAfter };
}

export async function reserveGenerationCredit(input: GenerationCreditInput): Promise<{ balanceAfter: number }> {
  return prisma.$transaction(async (tx) => reserveGenerationCreditInTransaction(tx, input));
}

export async function consumeReservedCreditInTransaction(
  tx: TransactionClient,
  input: GenerationCreditInput,
): Promise<void> {
  const amount = normalizeAmount(input.amount);
  const balanceAfter = await currentBalance(tx, input.userId);
  const consumed = await tx.creditTransaction.createMany({
    data: {
      userId: input.userId,
      generationId: input.generationId,
      type: "consume",
      amount: 0,
      balanceAfter,
      reason: input.reason,
      metadata: JSON.stringify({ reservedAmount: amount }),
    },
    skipDuplicates: true,
  });

  if (consumed.count !== 1) {
    return;
  }
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
  const reserved = await tx.creditTransaction.findFirst({
    where: {
      userId: input.userId,
      generationId: input.generationId,
      type: "reserve",
    },
    select: { id: true },
  });
  const consumed = await tx.creditTransaction.findFirst({
    where: {
      userId: input.userId,
      generationId: input.generationId,
      type: "consume",
    },
    select: { id: true },
  });

  if (!reserved || consumed) {
    return;
  }

  const refund = await tx.creditTransaction.createMany({
    data: {
      userId: input.userId,
      generationId: input.generationId,
      type: "refund",
      amount,
      balanceAfter: 0,
      reason: input.reason,
    },
    skipDuplicates: true,
  });

  if (refund.count !== 1) {
    return;
  }

  const user = await tx.user.update({
    where: { id: input.userId },
    data: { credits: { increment: amount } },
    select: { credits: true },
  });

  await tx.creditTransaction.updateMany({
    where: {
      userId: input.userId,
      generationId: input.generationId,
      type: "refund",
    },
    data: { balanceAfter: user.credits },
  });
}

export async function refundGenerationCredit(input: GenerationCreditInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await refundGenerationCreditInTransaction(tx, input);
  });
}
