import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { refundGenerationCreditInTransaction } from "@/lib/credits";
import { getGenerationCreditCostForRecord } from "@/lib/generation-credit-cost";
import { prisma } from "@/lib/db";
import {
  generationToDto,
  processGenerationProviderResult,
} from "@/lib/generation-processing";

export const runtime = "nodejs";

const PENDING_START_STALE_MS = 10 * 60 * 1000;
const PENDING_START_TIMEOUT_MESSAGE = "Generation did not start in time. Please try again.";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const generation = await prisma.generation.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      userId: true,
      model: true,
      taskId: true,
      status: true,
      resultUrls: true,
      resultAssetKeys: true,
      errorMessage: true,
      providerPollErrorCount: true,
      aspectRatio: true,
      resolution: true,
      quality: true,
      outputFormat: true,
      createdAt: true,
    },
  });

  if (!generation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (generation.status === "pending" && !generation.taskId) {
    const stalePendingStartedBefore = new Date(Date.now() - PENDING_START_STALE_MS);

    if (generation.createdAt <= stalePendingStartedBefore) {
      const { current, markedFailed } = await prisma.$transaction(async (tx) => {
        const write = await tx.generation.updateMany({
          where: {
            id: generation.id,
            userId: generation.userId,
            status: "pending",
            taskId: null,
            createdAt: { lte: stalePendingStartedBefore },
          },
          data: {
            status: "failed",
            errorMessage: PENDING_START_TIMEOUT_MESSAGE,
          },
        });

        if (write.count === 1) {
          await refundGenerationCreditInTransaction(tx, {
            userId: generation.userId,
            generationId: generation.id,
            amount: getGenerationCreditCostForRecord(generation),
            reason: "Refund reserved credit after generation start timed out",
          });
        }

        const currentGeneration = await tx.generation.findUniqueOrThrow({
          where: { id: generation.id },
          select: {
            id: true,
            model: true,
            taskId: true,
            status: true,
            resultUrls: true,
            resultAssetKeys: true,
            errorMessage: true,
            aspectRatio: true,
            resolution: true,
            quality: true,
            outputFormat: true,
          },
        });

        return {
          current: currentGeneration,
          markedFailed: write.count === 1,
        };
      });

      return NextResponse.json(await generationToDto(current), { status: markedFailed ? 500 : 200 });
    }

    return NextResponse.json({
      ...(await generationToDto(generation)),
      taskState: "pending",
    });
  }

  const result = await processGenerationProviderResult(generation);
  return NextResponse.json(result.body, { status: result.status });
}
