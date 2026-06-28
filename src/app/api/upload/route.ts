import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadBase64, KieError } from "@/lib/kie";
import { prisma } from "@/lib/db";
import { putObjectToR2 } from "@/lib/storage/r2";
import { userUploadKey } from "@/lib/storage/keys";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function parseBase64Image(input: string | undefined, requestedMimeType: string | undefined) {
  if (typeof input !== "string") {
    return { error: "base64Data is required" } as const;
  }

  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return { error: "base64Data is required" } as const;
  }

  let payloadBase64 = trimmedInput;
  let detectedMimeType: string | undefined;
  const dataUrlMatch = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/is.exec(trimmedInput);

  if (dataUrlMatch) {
    detectedMimeType = dataUrlMatch[1]?.trim() || undefined;
    payloadBase64 = dataUrlMatch[2] ?? "";
  }

  const normalizedPayload = payloadBase64.replace(/\s+/g, "");
  if (!normalizedPayload || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedPayload)) {
    return { error: "Invalid base64Data" } as const;
  }

  const buffer = Buffer.from(normalizedPayload, "base64");
  if (buffer.byteLength === 0) {
    return { error: "Invalid base64Data" } as const;
  }

  const canonicalPayload = normalizedPayload.replace(/=+$/, "");
  const canonicalDecoded = buffer.toString("base64").replace(/=+$/, "");
  if (canonicalPayload !== canonicalDecoded) {
    return { error: "Invalid base64Data" } as const;
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return { error: "File too large (max 20MB)", status: 413 } as const;
  }

  return {
    buffer,
    effectiveMimeType: detectedMimeType || requestedMimeType || "image/png",
  } as const;
}

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

    const parsed = parseBase64Image(base64Data, mimeType);
    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status ?? 400 },
      );
    }

    const key = userUploadKey(session.user.id, filename || "upload");
    const r2Upload = await putObjectToR2({
      key,
      body: parsed.buffer,
      contentType: parsed.effectiveMimeType,
    });
    const result = await uploadBase64(base64Data, filename);

    // Persist to DB for history tracking
    const [, upload] = await prisma.$transaction([
      prisma.asset.create({
        data: {
          userId: session.user.id,
          kind: "upload",
          bucket: r2Upload.bucket,
          key: r2Upload.key,
          url: r2Upload.url,
          filename: result.fileName,
          mimeType: parsed.effectiveMimeType,
          size: parsed.buffer.byteLength,
        },
      }),
      prisma.upload.create({
        data: {
          userId: session.user.id,
          url: result.downloadUrl,
          filename: result.fileName,
          size: parsed.buffer.byteLength,
          mimeType: parsed.effectiveMimeType,
          r2Key: r2Upload.key,
          r2Url: r2Upload.url,
          providerUrl: result.downloadUrl,
        },
      }),
    ]);

    return NextResponse.json({
      uploadId: upload.id,
      url: result.downloadUrl,
      r2Key: r2Upload.key,
      r2Url: r2Upload.url,
      providerUrl: result.downloadUrl,
      fileName: result.fileName,
      size: parsed.buffer.byteLength,
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
