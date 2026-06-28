import { randomUUID } from "node:crypto";

function sanitizeKeySegment(value: string, fallback: string) {
  const sanitized = value
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/[.-]+$/, "");

  return sanitized || fallback;
}

export function userUploadKey(userId: string, filename: string) {
  const safeUserId = sanitizeKeySegment(userId, "user");
  const safeFilename = sanitizeKeySegment(filename, "upload");

  return `users/${safeUserId}/uploads/${Date.now()}-${randomUUID()}-${safeFilename}`;
}

export function generatedImageKey(userId: string, generationId: string, index: number, extension: string) {
  const safeUserId = sanitizeKeySegment(userId, "user");
  const safeGenerationId = sanitizeKeySegment(generationId, "generation");
  const safeExtension = sanitizeKeySegment(extension.replace(/^\.+/, ""), "png").toLowerCase();

  return `users/${safeUserId}/generated/${safeGenerationId}/${index}.${safeExtension}`;
}
