import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processGenerationProviderResult, type GenerationForProcessing } from "@/lib/generation-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringFromPayload(payload: unknown, keys: Set<string>): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (keys.has(key) && typeof value === "string" && value.length > 0) {
      return value;
    }

    if (value && typeof value === "object") {
      const nestedValue = stringFromPayload(value, keys);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function validateCallbackToken(req: NextRequest) {
  const secret = process.env.KIE_CALLBACK_SECRET;
  const token = req.nextUrl.searchParams.get("token");

  return Boolean(secret && token && token === secret);
}

async function loadGeneration(input: {
  generationId: string | null;
  taskId: string | null;
}): Promise<GenerationForProcessing | null> {
  const where = input.generationId
    ? { id: input.generationId }
    : input.taskId
    ? { taskId: input.taskId }
    : null;

  if (!where) {
    return null;
  }

  const generation = await prisma.generation.findFirst({
    where,
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
    },
  });

  if (!generation) {
    return null;
  }

  if (input.taskId && generation.taskId && generation.taskId !== input.taskId) {
    throw new Error("Callback taskId does not match generation");
  }

  if (input.taskId && !generation.taskId) {
    await prisma.generation.updateMany({
      where: {
        id: generation.id,
        taskId: null,
        status: "pending",
      },
      data: {
        taskId: input.taskId,
        status: "processing",
      },
    });

    return prisma.generation.findUniqueOrThrow({
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
        aspectRatio: true,
        resolution: true,
        quality: true,
        outputFormat: true,
      },
    });
  }

  return generation;
}

export async function POST(req: NextRequest) {
  if (!validateCallbackToken(req)) {
    return NextResponse.json({ error: "Invalid callback token" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const generationId =
    req.nextUrl.searchParams.get("generationId") ??
    stringFromPayload(payload, new Set(["generationId", "generation_id"]));
  const taskId = stringFromPayload(payload, new Set(["taskId", "task_id"]));

  try {
    const generation = await loadGeneration({ generationId, taskId });
    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    const result = await processGenerationProviderResult(generation);

    return NextResponse.json({
      received: true,
      generationId: generation.id,
      taskId: generation.taskId,
      status: result.body.status,
    });
  } catch (error) {
    console.error("Kie callback processing failed", error);
    return NextResponse.json({ error: "Callback processing failed" }, { status: 500 });
  }
}
