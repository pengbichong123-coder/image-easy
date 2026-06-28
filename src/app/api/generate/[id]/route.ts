import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGenerationTaskResult, KieError } from "@/lib/kie";
import { generatedImageKey } from "@/lib/storage/keys";
import { copyRemoteImageToR2, deleteObjectFromR2, getSignedAssetUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
const STORAGE_FAILED_MESSAGE = "Image generated but storage failed. Please retry.";

type Props = {
  params: Promise<{ id: string }>;
};

function toDto(generation: {
  id: string;
  model: string;
  taskId: string | null;
  status: string;
  resultUrls: string | null;
  errorMessage: string | null;
}) {
  return {
    id: generation.id,
    model: generation.model,
    taskId: generation.taskId,
    status: generation.status,
    resultUrls: generation.resultUrls ? JSON.parse(generation.resultUrls) : [],
    errorMessage: generation.errorMessage,
  };
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

async function getRemoteImageExtension(sourceUrl: string) {
  try {
    const response = await fetch(sourceUrl, { method: "HEAD" });
    if (!response.ok) {
      return "png";
    }

    return extensionFromMimeType(response.headers.get("content-type")?.split(";")[0]?.trim());
  } catch {
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
  index: number;
  copiedKeys: string[];
}) {
  const initialExtension = await getRemoteImageExtension(input.sourceUrl);
  let key = generatedImageKey(input.userId, input.generationId, input.index, initialExtension);
  let copied = await copyRemoteImageToR2({ sourceUrl: input.sourceUrl, key });
  input.copiedKeys.push(copied.key);

  const copiedExtension = extensionFromMimeType(copied.mimeType);
  if (copiedExtension !== initialExtension) {
    await deleteObjectFromR2(copied.key);
    const copiedKeyIndex = input.copiedKeys.indexOf(copied.key);
    if (copiedKeyIndex !== -1) {
      input.copiedKeys.splice(copiedKeyIndex, 1);
    }

    key = generatedImageKey(input.userId, input.generationId, input.index, copiedExtension);
    copied = await copyRemoteImageToR2({ sourceUrl: input.sourceUrl, key });
    input.copiedKeys.push(copied.key);
  }

  const url = copied.url ?? (await getSignedAssetUrl(copied.key));

  return {
    bucket: copied.bucket,
    key: copied.key,
    url,
    filename: `${input.generationId}-${input.index}.${copiedExtension}`,
    mimeType: copied.mimeType,
    size: copied.size,
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
    },
  });

  if (!generation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!generation.taskId || generation.status === "completed" || generation.status === "failed") {
    return NextResponse.json(toDto(generation));
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

    const failed = await prisma.$transaction(async (tx) => {
      await tx.generation.updateMany({
        where: {
          id: generation.id,
          status: { not: "completed" },
        },
        data: { status: "failed", errorMessage: message },
      });

      return tx.generation.findUniqueOrThrow({
        where: { id: generation.id },
        select: {
          id: true,
          model: true,
          taskId: true,
          status: true,
          resultUrls: true,
          errorMessage: true,
        },
      });
    });

    return NextResponse.json(toDto(failed), { status: 500 });
  }

  const { record, result } = taskResult;
  if (!result) {
    return NextResponse.json({
      ...toDto(generation),
      status: "processing",
      taskState: record.state,
    });
  }

  const copiedKeys: string[] = [];

  try {
    const storageLock = await prisma.generation.updateMany({
      where: {
        id: generation.id,
        userId: generation.userId,
        status: { notIn: ["completed", "failed"] },
        resultAssetKeys: null,
      },
      data: {
        resultAssetKeys: JSON.stringify([]),
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
          errorMessage: true,
        },
      });

      if (current.status === "completed" || current.status === "failed") {
        return NextResponse.json(toDto(current));
      }

      return NextResponse.json({
        ...toDto(current),
        status: "processing",
        taskState: record.state,
      });
    }

    const creditsToConsume = Math.max(result.creditsConsumed ?? 1, 1);
    const generatedAssets: Awaited<ReturnType<typeof copyGeneratedImage>>[] = [];
    for (const [index, sourceUrl] of result.resultUrls.entries()) {
      generatedAssets.push(
        await copyGeneratedImage({
          sourceUrl,
          userId: generation.userId,
          generationId: generation.id,
          index,
          copiedKeys,
        }),
      );
    }

    const resultUrls = generatedAssets.map((asset) => asset.url);
    const resultAssetKeys = generatedAssets.map((asset) => asset.key);

    const updated = await prisma.$transaction(async (tx) => {
      const write = await tx.generation.updateMany({
        where: {
          id: generation.id,
          status: { notIn: ["completed", "failed"] },
          resultAssetKeys: JSON.stringify([]),
        },
        data: {
          status: "completed",
          resultUrls: JSON.stringify(resultUrls),
          resultAssetKeys: JSON.stringify(resultAssetKeys),
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
            url: asset.url,
            filename: asset.filename,
            mimeType: asset.mimeType,
            size: asset.size,
          })),
        });
      }

      await tx.user.update({
        where: { id: generation.userId },
        data: { credits: { decrement: creditsToConsume } },
      });

      return tx.generation.findUniqueOrThrow({
        where: { id: generation.id },
        select: {
          id: true,
          model: true,
          taskId: true,
          status: true,
          resultUrls: true,
          errorMessage: true,
        },
      });
    });

    return NextResponse.json({
      ...toDto(updated),
      costTime: result.costTime,
      creditsConsumed: creditsToConsume,
    });
  } catch (error) {
    await cleanupCopiedObjects(copiedKeys);

    console.error("Generated image storage failed:", error);
    const failed = await prisma.$transaction(async (tx) => {
      await tx.generation.updateMany({
        where: {
          id: generation.id,
          status: { not: "completed" },
        },
        data: {
          status: "failed",
          errorMessage: STORAGE_FAILED_MESSAGE,
          resultAssetKeys: null,
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
          errorMessage: true,
        },
      });
    });

    return NextResponse.json(toDto(failed), { status: 500 });
  }
}
