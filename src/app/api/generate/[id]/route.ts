import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { consumeReservedCreditInTransaction, refundGenerationCreditInTransaction } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { getGenerationTaskResult, KieError } from "@/lib/kie";
import { generatedImageKey } from "@/lib/storage/keys";
import { deleteObjectFromR2, fetchRemoteImageForR2, getSignedAssetUrl, putObjectToR2 } from "@/lib/storage/r2";

export const runtime = "nodejs";
const GENERATION_CREDIT_COST = 1;
const STORAGE_FAILED_MESSAGE = "Image generated but storage failed. Please retry.";
const STORAGE_LOCK_STALE_MS = 10 * 60 * 1000;
const PENDING_START_STALE_MS = 10 * 60 * 1000;
const PENDING_START_TIMEOUT_MESSAGE = "Generation did not start in time. Please try again.";
const PROVIDER_TRANSIENT_ERROR_LIMIT = 3;

type Props = {
  params: Promise<{ id: string }>;
};

function parseJsonStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    console.error("Failed to parse generation result metadata");
    return [];
  }
}

async function toDto(generation: {
  id: string;
  model: string;
  taskId: string | null;
  status: string;
  resultUrls: string | null;
  resultAssetKeys: string | null;
  errorMessage: string | null;
}) {
  const persistedResultUrls = parseJsonStringArray(generation.resultUrls);
  const resultUrls =
    persistedResultUrls.length > 0
      ? persistedResultUrls
      : await Promise.all(parseJsonStringArray(generation.resultAssetKeys).map((key) => getSignedAssetUrl(key)));

  return {
    id: generation.id,
    model: generation.model,
    taskId: generation.taskId,
    status: generation.status,
    resultUrls,
    errorMessage: generation.errorMessage,
  };
}

function providerTransientFailureMessage(message: string) {
  return `Generation provider returned a temporary error after ${PROVIDER_TRANSIENT_ERROR_LIMIT} retries: ${message}`;
}

function extensionFromMimeType(mimeType: string | undefined) {
  switch (mimeType?.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

async function cleanupCopiedObjects(keys: string[]) {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteObjectFromR2(key);
      } catch (error) {
        console.error("Failed to clean up generated R2 object", error);
      }
    }),
  );
}

async function copyGeneratedImage(input: {
  sourceUrl: string;
  userId: string;
  generationId: string;
  attemptId: string;
  index: number;
  copiedKeys: string[];
}) {
  const remoteImage = await fetchRemoteImageForR2({ sourceUrl: input.sourceUrl });
  const extension = extensionFromMimeType(remoteImage.mimeType);
  const key = generatedImageKey(input.userId, `${input.generationId}-${input.attemptId}`, input.index, extension);
  const upload = await putObjectToR2({
    key,
    body: remoteImage.body,
    contentType: remoteImage.mimeType,
  });
  input.copiedKeys.push(upload.key);

  return {
    bucket: upload.bucket,
    key: upload.key,
    url: upload.url,
    filename: `${input.generationId}-${input.index}.${extension}`,
    mimeType: remoteImage.mimeType,
    size: remoteImage.size,
  };
}

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
            amount: GENERATION_CREDIT_COST,
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
          },
        });

        return {
          current: currentGeneration,
          markedFailed: write.count === 1,
        };
      });

      return NextResponse.json(await toDto(current), { status: markedFailed ? 500 : 200 });
    }

    return NextResponse.json({
      ...(await toDto(generation)),
      taskState: "pending",
    });
  }

  if (generation.status === "completed" || generation.status === "failed") {
    return NextResponse.json(await toDto(generation));
  }

  if (!generation.taskId) {
    return NextResponse.json({
      ...(await toDto(generation)),
      status: "processing",
    });
  }

  let taskResult: Awaited<ReturnType<typeof getGenerationTaskResult>>;
  try {
    taskResult = await getGenerationTaskResult(generation.taskId);
  } catch (error) {
    const message =
      error instanceof KieError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Generation failed";

    if (!(error instanceof KieError && error.terminal)) {
      const { current, markedFailed } = await prisma.$transaction(async (tx) => {
        await tx.generation.updateMany({
          where: {
            id: generation.id,
            userId: generation.userId,
            status: { notIn: ["completed", "failed"] },
          },
          data: {
            providerPollErrorCount: { increment: 1 },
            providerPollErrorCode: error instanceof KieError ? String(error.code) : null,
            errorMessage: message,
          },
        });

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
            providerPollErrorCount: true,
          },
        });

        if (
          currentGeneration.status !== "completed" &&
          currentGeneration.status !== "failed" &&
          currentGeneration.providerPollErrorCount >= PROVIDER_TRANSIENT_ERROR_LIMIT
        ) {
          const failureMessage = providerTransientFailureMessage(message);
          const write = await tx.generation.updateMany({
            where: {
              id: generation.id,
              status: { notIn: ["completed", "failed"] },
            },
            data: {
              status: "failed",
              errorMessage: failureMessage,
            },
          });

          if (write.count === 1) {
            await refundGenerationCreditInTransaction(tx, {
              userId: generation.userId,
              generationId: generation.id,
              amount: GENERATION_CREDIT_COST,
              reason: "Refund reserved credit after provider transient errors exceeded retry limit",
            });
          }

          const failedGeneration = await tx.generation.findUniqueOrThrow({
            where: { id: generation.id },
            select: {
              id: true,
              model: true,
              taskId: true,
              status: true,
              resultUrls: true,
              resultAssetKeys: true,
              errorMessage: true,
            },
          });

          return {
            current: failedGeneration,
            markedFailed: write.count === 1,
          };
        }

        return {
          current: currentGeneration,
          markedFailed: false,
        };
      });

      if (current.status === "failed") {
        return NextResponse.json(await toDto(current), { status: markedFailed ? 500 : 200 });
      }

      return NextResponse.json({
        ...(await toDto(current)),
        status: "processing",
        errorMessage: message,
        taskState: "polling_error",
        providerPollErrorCount:
          "providerPollErrorCount" in current ? current.providerPollErrorCount : undefined,
      });
    }

    const activeStorageStartedAfter = new Date(Date.now() - STORAGE_LOCK_STALE_MS);

    const { current, markedFailed } = await prisma.$transaction(async (tx) => {
      const write = await tx.generation.updateMany({
        where: {
          id: generation.id,
          status: { notIn: ["completed", "failed"] },
          NOT: {
            storageStatus: "processing",
            OR: [
              { storageStartedAt: null },
              { storageStartedAt: { gte: activeStorageStartedAfter } },
            ],
          },
        },
        data: { status: "failed", errorMessage: message },
      });

      if (write.count === 1) {
        await refundGenerationCreditInTransaction(tx, {
          userId: generation.userId,
          generationId: generation.id,
          amount: GENERATION_CREDIT_COST,
          reason: "Refund reserved credit after generation failed",
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
        },
      });

      return {
        current: currentGeneration,
        markedFailed: write.count === 1,
      };
    });

    if (!markedFailed && current.status !== "completed" && current.status !== "failed") {
      return NextResponse.json({
        ...(await toDto(current)),
        status: "processing",
      });
    }

    return NextResponse.json(await toDto(current), { status: markedFailed ? 500 : 200 });
  }

  const { record, result } = taskResult;
  let responseGeneration = generation;
  if (generation.providerPollErrorCount > 0) {
    responseGeneration = await prisma.$transaction(async (tx) => {
      await tx.generation.updateMany({
        where: {
          id: generation.id,
          userId: generation.userId,
          status: { notIn: ["completed", "failed"] },
        },
        data: {
          providerPollErrorCount: 0,
          providerPollErrorCode: null,
          errorMessage: null,
        },
      });

      return tx.generation.findUniqueOrThrow({
        where: { id: generation.id },
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
          createdAt: true,
        },
      });
    });
  }

  if (!result) {
    return NextResponse.json({
      ...(await toDto(responseGeneration)),
      status: "processing",
      taskState: record.state,
    });
  }

  const copiedKeys: string[] = [];
  const storageStartedAt = new Date();
  const staleStorageStartedBefore = new Date(storageStartedAt.getTime() - STORAGE_LOCK_STALE_MS);
  const attemptId = randomUUID();

  try {
    const storageLock = await prisma.generation.updateMany({
      where: {
        id: generation.id,
        userId: generation.userId,
        status: { notIn: ["completed", "failed"] },
        OR: [
          { storageStatus: null },
          { storageStatus: "failed" },
          {
            storageStatus: "processing",
            storageStartedAt: { lt: staleStorageStartedBefore },
          },
        ],
      },
      data: {
        storageStatus: "processing",
        storageStartedAt,
        storageAttemptId: attemptId,
      },
    });

    if (storageLock.count !== 1) {
      const current = await prisma.generation.findUniqueOrThrow({
        where: { id: generation.id },
        select: {
          id: true,
          model: true,
          taskId: true,
          status: true,
          resultUrls: true,
          resultAssetKeys: true,
          errorMessage: true,
        },
      });

      if (current.status === "completed" || current.status === "failed") {
        return NextResponse.json(await toDto(current));
      }

      return NextResponse.json({
        ...(await toDto(current)),
        status: "processing",
        taskState: record.state,
      });
    }

    const creditsToConsume = GENERATION_CREDIT_COST;
    const generatedAssets: Awaited<ReturnType<typeof copyGeneratedImage>>[] = [];
    for (const [index, sourceUrl] of result.resultUrls.entries()) {
      generatedAssets.push(
        await copyGeneratedImage({
          sourceUrl,
          userId: generation.userId,
          generationId: generation.id,
          attemptId,
          index,
          copiedKeys,
        }),
      );
    }

    const resultUrls = generatedAssets.map((asset) => asset.url);
    const resultAssetKeys = generatedAssets.map((asset) => asset.key);
    const publicResultUrls = resultUrls.filter((url): url is string => Boolean(url));

    const updated = await prisma.$transaction(async (tx) => {
      const write = await tx.generation.updateMany({
        where: {
          id: generation.id,
          status: { notIn: ["completed", "failed"] },
          storageStatus: "processing",
          storageStartedAt,
          storageAttemptId: attemptId,
        },
        data: {
          status: "completed",
          resultUrls: publicResultUrls.length > 0 ? JSON.stringify(publicResultUrls) : null,
          resultAssetKeys: JSON.stringify(resultAssetKeys),
          storageStatus: "completed",
          storageAttemptId: attemptId,
          errorMessage: null,
        },
      });

      if (write.count !== 1) {
        throw new Error("Generation storage precondition failed");
      }

      if (generatedAssets.length > 0) {
        await tx.asset.createMany({
          data: generatedAssets.map((asset) => ({
            userId: generation.userId,
            kind: "generated",
            bucket: asset.bucket,
            key: asset.key,
            url: asset.url ?? null,
            filename: asset.filename,
            mimeType: asset.mimeType,
            size: asset.size,
          })),
        });
      }

      await consumeReservedCreditInTransaction(tx, {
        userId: generation.userId,
        generationId: generation.id,
        amount: creditsToConsume,
        reason: "Consume reserved credit after generation completed",
      });

      return tx.generation.findUniqueOrThrow({
        where: { id: generation.id },
        select: {
          id: true,
          model: true,
          taskId: true,
          status: true,
          resultUrls: true,
          resultAssetKeys: true,
          errorMessage: true,
        },
      });
    });

    return NextResponse.json({
      ...(await toDto(updated)),
      costTime: result.costTime,
      creditsConsumed: creditsToConsume,
    });
  } catch (error) {
    await cleanupCopiedObjects(copiedKeys);

    console.error("Generated image storage failed:", error);
    const current = await prisma.$transaction(async (tx) => {
      await tx.generation.updateMany({
        where: {
          id: generation.id,
          status: { notIn: ["completed", "failed"] },
          storageStatus: "processing",
          storageStartedAt,
          storageAttemptId: attemptId,
        },
        data: {
          status: "processing",
          errorMessage: STORAGE_FAILED_MESSAGE,
          storageStatus: "failed",
          storageAttemptId: attemptId,
        },
      });

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
        },
      });

      return currentGeneration;
    });

    if (current.status !== "completed" && current.status !== "failed") {
      return NextResponse.json({
        ...(await toDto(current)),
        status: "processing",
        taskState: record.state,
      });
    }

    return NextResponse.json(await toDto(current), { status: current.status === "completed" ? 200 : 500 });
  }
}
