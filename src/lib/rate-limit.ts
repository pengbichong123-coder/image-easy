import { prisma } from "./db";

const UPLOADS_PER_HOUR_LIMIT = 60;
const GENERATIONS_PER_HOUR_LIMIT = 20;
const PROCESSING_GENERATIONS_LIMIT = 2;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export class RateLimitError extends Error {
  constructor() {
    super("Rate limit reached. Please try again later.");
    this.name = "RateLimitError";
  }
}

function oneHourAgo() {
  return new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
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
  const [recentGenerations, activeGenerations] = await prisma.$transaction([
    prisma.generation.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo() },
      },
    }),
    prisma.generation.count({
      where: {
        userId,
        status: { in: ["pending", "processing"] },
      },
    }),
  ]);

  if (
    recentGenerations >= GENERATIONS_PER_HOUR_LIMIT ||
    activeGenerations >= PROCESSING_GENERATIONS_LIMIT
  ) {
    throw new RateLimitError();
  }
}
