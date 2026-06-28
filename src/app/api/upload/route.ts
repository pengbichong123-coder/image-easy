import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadBase64, KieError } from "@/lib/kie";
import { prisma } from "@/lib/db";
import { deleteObjectFromR2, putObjectToR2 } from "@/lib/storage/r2";
import { userUploadKey } from "@/lib/storage/keys";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function normalizeMimeType(value: string | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() || undefined;
}

function estimateBase64DecodedByteLength(payload: string) {
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;

  return Math.floor((payload.length * 3) / 4) - padding;
}

function sniffImageMimeType(buffer: Buffer): string | undefined {
  if (
    buffer.byteLength >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.byteLength >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.byteLength >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.byteLength >= 6) {
    const signature = buffer.subarray(0, 6).toString("ascii");
    if (signature === "GIF87a" || signature === "GIF89a") {
      return "image/gif";
    }
  }

  return undefined;
}

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
  let isDataUrl = false;
  const dataUrlMatch = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/is.exec(trimmedInput);

  if (dataUrlMatch) {
    isDataUrl = true;
    detectedMimeType = normalizeMimeType(dataUrlMatch[1]);
    payloadBase64 = dataUrlMatch[2] ?? "";
  }

  const declaredMimeTypes = [
    detectedMimeType,
    normalizeMimeType(requestedMimeType),
  ].filter((mimeType): mimeType is string => Boolean(mimeType));
  for (const declaredMimeType of declaredMimeTypes) {
    if (!declaredMimeType.startsWith("image/")) {
      return { error: "Unsupported upload MIME type" } as const;
    }

    if (!SUPPORTED_UPLOAD_MIME_TYPES.has(declaredMimeType)) {
      return { error: "Unsupported image MIME type" } as const;
    }
  }

  const normalizedPayload = payloadBase64.replace(/\s+/g, "");
  if (!normalizedPayload || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedPayload)) {
    return { error: "Invalid base64Data" } as const;
  }

  if (normalizedPayload.length % 4 === 1) {
    return { error: "Invalid base64Data" } as const;
  }

  if (estimateBase64DecodedByteLength(normalizedPayload) > MAX_UPLOAD_BYTES) {
    return { error: "File too large (max 20MB)", status: 413 } as const;
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

  const sniffedMimeType = sniffImageMimeType(buffer);
  if (!sniffedMimeType) {
    return { error: "Unsupported or invalid image data" } as const;
  }

  if (!SUPPORTED_UPLOAD_MIME_TYPES.has(sniffedMimeType)) {
    return { error: "Unsupported image MIME type" } as const;
  }

  if (declaredMimeTypes.some((declaredMimeType) => declaredMimeType !== sniffedMimeType)) {
    return { error: "Image MIME type does not match file data" } as const;
  }

  return {
    buffer,
    effectiveMimeType: sniffedMimeType,
    providerBase64Data: isDataUrl ? `data:${sniffedMimeType};base64,${normalizedPayload}` : normalizedPayload,
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

    try {
      const result = await uploadBase64(parsed.providerBase64Data, filename);

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
      try {
        await deleteObjectFromR2(r2Upload.key);
      } catch (cleanupError) {
        console.error("Failed to clean up R2 upload after upload failure", cleanupError);
      }

      throw error;
    }
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
