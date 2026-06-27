import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

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
    items: items.map((g) => ({
      id: g.id,
      model: g.model,
      prompt: g.prompt,
      aspectRatio: g.aspectRatio,
      resolution: g.resolution,
      quality: g.quality,
      outputFormat: g.outputFormat,
      status: g.status,
      resultUrls: g.resultUrls ? JSON.parse(g.resultUrls) : [],
      errorMessage: g.errorMessage,
      createdAt: g.createdAt,
      upload: g.upload
        ? { id: g.upload.id, url: g.upload.url, filename: g.upload.filename }
        : null,
    })),
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
  const result = await prisma.generation.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
