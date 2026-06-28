import { randomUUID } from "node:crypto";
import { consumeReservedCreditInTransaction, refundGenerationCreditInTransaction } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { getGenerationCreditCostForRecord } from "@/lib/generation-credit-cost";
import { resolveGenerationResultUrls } from "@/lib/generation-results";
import { getGenerationTaskResult, KieError } from "@/lib/kie";
import { generatedImageKey } from "@/lib/storage/keys";
import { deleteObjectFromR2, fetchRemoteImageForR2, getSignedAssetUrl, putObjectToR2 } from "@/lib/storage/r2";

const STORAGE_FAILED_MESSAGE = "Image generated but storage failed. Please retry.";
const STORAGE_LOCK_STALE_MS = 10 * 60 * 1000;
const PROVIDER_TRANSIENT_ERROR_LIMIT = 3;

export type GenerationForProcessing = {
  id: string;
  userId: string;
  model: string;
  taskId: string | null;
  status: string;
  resultUrls: string | null;
  resultAssetKeys: string | null;
  errorMessage: string | null;
  providerPollErrorCount: number;
  aspectRatio?: string | null;
  resolution?: string | null;
  quality?: string | null;
  outputFormat?: string | null;
};

export function canMarkGenerationFailedWithStorageState(input: {
  storageStatus: string | null;
  storageStartedAt: Date | null;
  staleStorageStartedBefore: Date;
}) {
  if (input.storageStatus !== "processing") {
    return true;
  }

  if (!input.storageStartedAt) {
    return false;
  }

  return input.storageStartedAt < input.staleStorageStartedBefore;
}

export async function generationToDto(generation: {
  id: string;
  model: string;
  taskId: string | null;
  status: string;
  resultUrls: string | null;
  resultAssetKeys: string | null;
  errorMessage: string | null;
}) {
  return {
    id: generation.id,
    model: generation.model,
    taskId: generation.taskId,
    status: generation.status,
    resultUrls: await resolveGenerationResultUrls(generation, getSignedAssetUrl),
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

async function markGenerationFailed(input: {
  generation: GenerationForProcessing;
  message: string;
  reason: string;
}) {
  const staleStorageStartedBefore = new Date(Date.now() - STORAGE_LOCK_STALE_MS);
  const { current, markedFailed } = await prisma.$transaction(async (tx) => {
    const write = await tx.generation.updateMany({
      where: {
        id: input.generation.id,
        status: { notIn: ["completed", "failed"] },
        OR: [
          { storageStatus: null },
          { storageStatus: { not: "processing" } },
          {
            storageStatus: "processing",
            storageStartedAt: { lt: staleStorageStartedBefore },
          },
        ],
      },
      data: { status: "failed", errorMessage: input.message },
    });

    if (write.count === 1) {
      await refundGenerationCreditInTransaction(tx, {
        userId: input.generation.userId,
        generationId: input.generation.id,
        amount: getGenerationCreditCostForRecord(input.generation),
        reason: input.reason,
      });
    }

    const currentGeneration = await tx.generation.findUniqueOrThrow({
      where: { id: input.generation.id },
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
    return {
      body: {
        ...(await generationToDto(current)),
        status: "processing",
      },
      status: 200,
    };
  }

  return {
    body: await generationToDto(current),
    status: markedFailed ? 500 : 200,
  };
}

async function handleTransientProviderError(input: {
  generation: GenerationForProcessing;
  error: unknown;
  message: string;
}) {
  const { current, markedFailed } = await prisma.$transaction(async (tx) => {
    await tx.generation.updateMany({
      where: {
        id: input.generation.id,
        userId: input.generation.userId,
        status: { notIn: ["completed", "failed"] },
      },
      data: {
        providerPollErrorCount: { increment: 1 },
        providerPollErrorCode: input.error instanceof KieError ? String(input.error.code) : null,
        errorMessage: input.message,
      },
    });

    const currentGeneration = await tx.generation.findUniqueOrThrow({
      where: { id: input.generation.id },
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
      const failureMessage = providerTransientFailureMessage(input.message);
      const write = await tx.generation.updateMany({
        where: {
          id: input.generation.id,
          status: { notIn: ["completed", "failed"] },
        },
        data: {
          status: "failed",
          errorMessage: failureMessage,
        },
      });

      if (write.count === 1) {
        await refundGenerationCreditInTransaction(tx, {
          userId: input.generation.userId,
          generationId: input.generation.id,
          amount: getGenerationCreditCostForRecord(input.generation),
          reason: "Refund reserved credit after provider transient errors exceeded retry limit",
        });
      }

      const failedGeneration = await tx.generation.findUniqueOrThrow({
        where: { id: input.generation.id },
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
    return {
      body: await generationToDto(current),
      status: markedFailed ? 500 : 200,
    };
  }

  return {
    body: {
      ...(await generationToDto(current)),
      status: "processing",
      errorMessage: input.message,
      taskState: "polling_error",
      providerPollErrorCount:
        "providerPollErrorCount" in current ? current.providerPollErrorCount : undefined,
    },
    status: 200,
  };
}

async function resetTransientProviderErrors(generation: GenerationForProcessing) {
  if (generation.providerPollErrorCount <= 0) {
    return generation;
  }

  return prisma.$transaction(async (tx) => {
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
      },
    });
  });
}

export async function processGenerationProviderResult(generation: GenerationForProcessing) {
  if (generation.status === "completed" || generation.status === "failed") {
    return {
      body: await generationToDto(generation),
      status: 200,
    };
  }

  if (!generation.taskId) {
    return {
      body: {
        ...(await generationToDto(generation)),
        status: "processing",
      },
      status: 200,
    };
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
      return handleTransientProviderError({ generation, error, message });
    }

    return markGenerationFailed({
      generation,
      message,
      reason: "Refund reserved credit after generation failed",
    });
  }

  const { record, result } = taskResult;
  const responseGeneration = await resetTransientProviderErrors(generation);

  if (!result) {
    return {
      body: {
        ...(await generationToDto(responseGeneration)),
        status: "processing",
        taskState: record.state,
      },
      status: 200,
    };
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
        return {
          body: await generationToDto(current),
          status: 200,
        };
      }

      return {
        body: {
          ...(await generationToDto(current)),
          status: "processing",
          taskState: record.state,
        },
        status: 200,
      };
    }

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
          providerPollErrorCount: 0,
          providerPollErrorCode: null,
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
        amount: getGenerationCreditCostForRecord(generation),
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

    return {
      body: {
        ...(await generationToDto(updated)),
        costTime: result.costTime,
        creditsConsumed: getGenerationCreditCostForRecord(generation),
      },
      status: 200,
    };
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

    if (current.status !== "completed" && current.status !== "failed") {
      return {
        body: {
          ...(await generationToDto(current)),
          status: "processing",
          taskState: record.state,
        },
        status: 200,
      };
    }

    return {
      body: await generationToDto(current),
      status: current.status === "completed" ? 200 : 500,
    };
  }
}
