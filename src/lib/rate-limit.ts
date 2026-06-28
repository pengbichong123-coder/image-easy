import { refundGenerationCreditInTransaction } from "./credits";
import { prisma } from "./db";

const UPLOADS_PER_HOUR_LIMIT = 60;
const GENERATIONS_PER_HOUR_LIMIT = 20;
const PROCESSING_GENERATIONS_LIMIT = 2;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const ACTIVE_GENERATION_STALE_MS = 30 * 60 * 1000;
const ACTIVE_GENERATION_STATUSES = ["pending", "processing"];
const STALE_GENERATION_ERROR_MESSAGE = "Generation timed out before completion. Please try again.";

export class RateLimitError extends Error {
  constructor() {
    super("Rate limit reached. Please try again later.");
    this.name = "RateLimitError";
  }
}

function oneHourAgo() {
  return new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
}

function activeGenerationStaleCutoff() {
  return new Date(Date.now() - ACTIVE_GENERATION_STALE_MS);
}

export async function assertCanUpload(userId: string): Promise<void> {
  const recentUploads = await prisma.upload.count({
    where: {
      userId,
      createdAt: { gte: oneHourAgo() },
    },
  });

  if (recentUploads >= UPLOADS_PER_HOUR_LIMIT) {
    throw new RateLimitError();
  }
}

export async function assertCanGenerate(userId: string): Promise<void> {
  const hourlyCutoff = oneHourAgo();
  const staleCutoff = activeGenerationStaleCutoff();

  const { recentGenerations, activeGenerations } = await prisma.$transaction(async (tx) => {
    const staleGenerations = await tx.generation.findMany({
      where: {
        userId,
        status: { in: ACTIVE_GENERATION_STATUSES },
        createdAt: { lt: staleCutoff },
      },
      select: {
        id: true,
      },
    });

    for (const generation of staleGenerations) {
      const write = await tx.generation.updateMany({
        where: {
          id: generation.id,
          userId,
          status: { in: ACTIVE_GENERATION_STATUSES },
          createdAt: { lt: staleCutoff },
        },
        data: {
          status: "failed",
          errorMessage: STALE_GENERATION_ERROR_MESSAGE,
        },
      });

      if (write.count === 1) {
        await refundGenerationCreditInTransaction(tx, {
          userId,
          generationId: generation.id,
          amount: 1,
          reason: "Refund reserved credit after generation timed out",
        });
      }
    }

    const [recentGenerations, activeGenerations] = await Promise.all([
      tx.generation.count({
        where: {
          userId,
          createdAt: { gte: hourlyCutoff },
        },
      }),
      tx.generation.count({
        where: {
          userId,
          status: { in: ACTIVE_GENERATION_STATUSES },
        },
      }),
    ]);

    return { recentGenerations, activeGenerations };
  });

  if (
    recentGenerations >= GENERATIONS_PER_HOUR_LIMIT ||
    activeGenerations >= PROCESSING_GENERATIONS_LIMIT
  ) {
    throw new RateLimitError();
  }
}
