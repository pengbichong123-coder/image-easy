import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  InsufficientCreditsError,
  refundGenerationCreditInTransaction,
  reserveGenerationCreditInTransaction,
} from "@/lib/credits";
import { KieError, submitGenerationTask } from "@/lib/kie";
import { prisma } from "@/lib/db";
import { getGenerationCreditCost } from "@/lib/generation-credit-cost";
import { buildKieCallbackUrl } from "@/lib/kie-callback";
import { assertCanGenerate, RateLimitError } from "@/lib/rate-limit";
import { MODELS, type ModelId, type AspectRatio, type Resolution, type Quality, type OutputFormat } from "@/lib/models";
import { z } from "zod";

export const runtime = "nodejs";

const generateSchema = z.object({
  model: z.enum([
    "gpt-image-2-text-to-image",
    "gpt-image-2-image-to-image",
    "seedream-4-5-text-to-image",
    "seedream-4-5-edit",
    "nano-banana-pro",
  ] as const),
  prompt: z.string().min(1).max(20000),
  aspectRatio: z.string().optional(),
  resolution: z.enum(["1K", "2K", "4K"]).optional(),
  quality: z.enum(["basic", "high"]).optional(),
  outputFormat: z.enum(["png", "jpg"]).optional(),
  imageUrls: z.array(z.string().url()).max(16).optional(),
  uploadIds: z.array(z.string()).max(16).optional(),
  nsfwChecker: z.boolean().optional(),
});

async function markGenerationFailedAndRefund(input: {
  userId: string;
  generationId: string;
  creditCost: number;
  message: string;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      const write = await tx.generation.updateMany({
        where: {
          id: input.generationId,
          userId: input.userId,
          status: { notIn: ["completed", "failed"] },
        },
        data: {
          status: "failed",
          errorMessage: input.message,
        },
      });

      if (write.count === 1) {
        await refundGenerationCreditInTransaction(tx, {
          userId: input.userId,
          generationId: input.generationId,
          amount: input.creditCost,
          reason: "Refund reserved credit after generation task creation failed",
        });
      }
    });
  } catch (error) {
    console.error("Failed to mark generation failed and refund reserved credit", error);
  }
}

// POST /api/generate - create a kie.ai task and return immediately.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof generateSchema>;
  try {
    body = generateSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request", details: (e as z.ZodError).issues },
      { status: 400 },
    );
  }

  const modelInfo = MODELS[body.model];
  if (!modelInfo) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  // Validate image-to-image models have images
  if (modelInfo.capability === "image-to-image") {
    const totalImages = (body.imageUrls?.length ?? 0) + (body.uploadIds?.length ?? 0);
    if (totalImages === 0) {
      return NextResponse.json(
        { error: `${modelInfo.displayName} requires at least one input image` },
        { status: 400 },
      );
    }
    if (totalImages > modelInfo.maxInputImages) {
      return NextResponse.json(
        { error: `Maximum ${modelInfo.maxInputImages} input images allowed` },
        { status: 400 },
      );
    }
  }

  // Resolve uploadIds to URLs (in addition to imageUrls)
  let imageUrls: string[] = [...(body.imageUrls ?? [])];
  if (body.uploadIds && body.uploadIds.length > 0) {
    const uploads = await prisma.upload.findMany({
      where: { id: { in: body.uploadIds }, userId: session.user.id },
      select: { id: true, url: true },
    });
    if (uploads.length !== body.uploadIds.length) {
      return NextResponse.json(
        { error: "One or more uploaded images were not found" },
        { status: 400 },
      );
    }
    imageUrls = imageUrls.concat(uploads.map((u) => u.url));
  }

  // Use the first uploadId as the primary one (for DB relation)
  const primaryUploadId = body.uploadIds?.[0] ?? null;

  // Validate prompt length per model
  if (body.prompt.length > modelInfo.maxPromptLength) {
    return NextResponse.json(
      {
        error: `Prompt too long (max ${modelInfo.maxPromptLength} chars for ${modelInfo.displayName})`,
      },
      { status: 400 },
    );
  }

  const creditCost = getGenerationCreditCost({
    model: body.model,
    aspectRatio: body.aspectRatio as AspectRatio | undefined,
    resolution: body.resolution,
    quality: body.quality,
    outputFormat: body.outputFormat,
  });

  try {
    await assertCanGenerate(session.user.id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 },
      );
    }

    console.error("Failed to check generation rate limit", error);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 },
    );
  }

  let generation: {
    id: string;
    model: string;
    taskId: string | null;
    status: string;
  };

  try {
    generation = await prisma.$transaction(async (tx) => {
      const pendingGeneration = await tx.generation.create({
        data: {
          userId: session.user.id,
          model: body.model,
          prompt: body.prompt,
          aspectRatio: body.aspectRatio,
          resolution: body.resolution,
          quality: body.quality,
          outputFormat: body.outputFormat,
          imageCount: 1,
          status: "pending",
          uploadId: primaryUploadId,
        },
        select: {
          id: true,
          model: true,
          taskId: true,
          status: true,
        },
      });

      await reserveGenerationCreditInTransaction(tx, {
        userId: session.user.id,
        generationId: pendingGeneration.id,
        amount: creditCost,
        reason: "Reserve credit for image generation",
      });

      return pendingGeneration;
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough credits" },
        { status: 402 },
      );
    }

    console.error("Failed to create generation reservation", error);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 },
    );
  }

  try {
    const taskId = await submitGenerationTask({
      model: body.model as ModelId,
      prompt: body.prompt,
      aspectRatio: body.aspectRatio as AspectRatio | undefined,
      resolution: body.resolution as Resolution | undefined,
      quality: body.quality as Quality | undefined,
      outputFormat: body.outputFormat as OutputFormat | undefined,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      nsfwChecker: body.nsfwChecker,
      callBackUrl: buildKieCallbackUrl(generation.id),
    });

    const started = await prisma.$transaction(async (tx) => {
      const write = await tx.generation.updateMany({
        where: {
          id: generation.id,
          userId: session.user.id,
          status: "pending",
        },
        data: {
          taskId,
          status: "processing",
          errorMessage: null,
        },
      });

      if (write.count !== 1) {
        throw new Error("Generation start precondition failed");
      }

      return tx.generation.findUniqueOrThrow({
        where: { id: generation.id },
        select: {
          id: true,
          model: true,
          taskId: true,
          status: true,
        },
      });
    });

    return NextResponse.json({
      id: started.id,
      model: started.model,
      taskId: started.taskId,
      status: started.status,
    });
  } catch (error) {
    const message =
      error instanceof KieError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Generation failed";
    await markGenerationFailedAndRefund({
      userId: session.user.id,
      generationId: generation.id,
      creditCost,
      message,
    });

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
