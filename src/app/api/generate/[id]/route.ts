import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGenerationTaskResult, KieError } from "@/lib/kie";

export const runtime = "nodejs";

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
      errorMessage: true,
    },
  });

  if (!generation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!generation.taskId || generation.status === "completed" || generation.status === "failed") {
    return NextResponse.json(toDto(generation));
  }

  try {
    const { record, result } = await getGenerationTaskResult(generation.taskId);

    if (!result) {
      return NextResponse.json({
        ...toDto(generation),
        status: "processing",
        taskState: record.state,
      });
    }

    const creditsToConsume = Math.max(result.creditsConsumed ?? 1, 1);
    const updated = await prisma.$transaction(async (tx) => {
      const write = await tx.generation.updateMany({
        where: {
          id: generation.id,
          status: { notIn: ["completed", "failed"] },
        },
        data: {
          status: "completed",
          resultUrls: JSON.stringify(result.resultUrls),
        },
      });

      if (write.count === 1) {
        await tx.user.update({
          where: { id: generation.userId },
          data: { credits: { decrement: creditsToConsume } },
        });
      }

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
}
