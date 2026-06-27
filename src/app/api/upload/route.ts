import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadBase64, KieError } from "@/lib/kie";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/upload  — upload an image to kie.ai (for image-to-image)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { base64Data, filename, mimeType } = body as {
      base64Data?: string;
      filename?: string;
      mimeType?: string;
    };

    if (!base64Data) {
      return NextResponse.json(
        { error: "base64Data is required" },
        { status: 400 },
      );
    }

    // Sanity check
    if (base64Data.length > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 20MB)" },
        { status: 413 },
      );
    }

    const result = await uploadBase64(base64Data, filename);

    // Persist to DB for history tracking
    const upload = await prisma.upload.create({
      data: {
        userId: session.user.id,
        url: result.downloadUrl,
        filename: result.fileName,
        size: result.fileSize,
        mimeType: result.mimeType || mimeType || "image/png",
      },
    });

    return NextResponse.json({
      uploadId: upload.id,
      url: result.downloadUrl,
      fileName: result.fileName,
      size: result.fileSize,
    });
  } catch (error) {
    if (error instanceof KieError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 401 ? 401 : 500 },
      );
    }
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
