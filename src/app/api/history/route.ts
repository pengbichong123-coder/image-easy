import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteObjectFromR2, getSignedAssetUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
const GENERATION_STILL_PROCESSING_MESSAGE = "Generation is still processing. Please wait before deleting it.";

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

async function getGenerationResultUrls(generation: {
  resultUrls: string | null;
  resultAssetKeys: string | null;
}) {
  try {
    const persistedResultUrls = parseJsonStringArray(generation.resultUrls);
    if (persistedResultUrls.length > 0) {
      return persistedResultUrls;
    }

    return await Promise.all(parseJsonStringArray(generation.resultAssetKeys).map((key) => getSignedAssetUrl(key)));
  } catch {
    console.error("Failed to resolve generation result URLs");
    return [];
  }
}

// GET /api/history?limit=30&cursor=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);
  const cursor = searchParams.get("cursor") ?? undefined;
  const model = searchParams.get("model") ?? undefined;

  const where: Record<string, unknown> = { userId: session.user.id };
  if (model) where.model = model;

  const items = await prisma.generation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { upload: true },
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop();
    nextCursor = next!.id;
  }

  return NextResponse.json({
    items: await Promise.all(
      items.map(async (g) => ({
        id: g.id,
        model: g.model,
        prompt: g.prompt,
        aspectRatio: g.aspectRatio,
        resolution: g.resolution,
        quality: g.quality,
        outputFormat: g.outputFormat,
        status: g.status,
        resultUrls: await getGenerationResultUrls(g),
        errorMessage: g.errorMessage,
        createdAt: g.createdAt,
        upload: g.upload
          ? { id: g.upload.id, url: g.upload.url, filename: g.upload.filename }
          : null,
      })),
    ),
    nextCursor,
  });
}

// DELETE /api/history — delete a generation record (and only its DB row; kie URLs may expire)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { found, isProcessing, resultAssetKeys } = await prisma.$transaction(async (tx) => {
    const generation = await tx.generation.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        status: true,
        resultAssetKeys: true,
      },
    });

    if (!generation) {
      return { found: false, isProcessing: false, resultAssetKeys: [] };
    }

    if (generation.status === "pending" || generation.status === "processing") {
      return { found: true, isProcessing: true, resultAssetKeys: [] };
    }

    const resultAssetKeys = parseJsonStringArray(generation.resultAssetKeys);
    if (resultAssetKeys.length > 0) {
      await tx.asset.deleteMany({
        where: {
          userId: session.user.id,
          key: { in: resultAssetKeys },
        },
      });
    }

    await tx.generation.deleteMany({
      where: { id: generation.id, userId: session.user.id },
    });

    return { found: true, isProcessing: false, resultAssetKeys };
  });

  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isProcessing) {
    return NextResponse.json(
      { error: GENERATION_STILL_PROCESSING_MESSAGE },
      { status: 409 },
    );
  }

  await Promise.all(
    resultAssetKeys.map(async (key) => {
      try {
        await deleteObjectFromR2(key);
      } catch {
        console.error("Failed to delete generated R2 object");
      }
    }),
  );

  return NextResponse.json({ success: true });
}
