"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

export interface UploadedImage {
  id: string;
  // uploadId is set when the image was freshly uploaded to kie.ai via /api/upload.
  // For "reuse" / external URLs, uploadId is omitted — the caller passes the url
  // through imageUrls instead, and the backend will route it through kie.ai's
  // URL upload endpoint on the way to createTask.
  uploadId?: string;
  url: string;
  filename: string;
  preview: string;
}

interface Props {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages: number;
  disabled?: boolean;
  onUpload?: (images: UploadedImage[]) => void;
}

export function ImageUploader({ images, onChange, maxImages, disabled, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("create");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      setError(t("uploaderMax", { max: maxImages }));
      return;
    }
    const filesToProcess = Array.from(files).slice(0, remaining);

    setUploading(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of filesToProcess) {
        if (file.size > 20 * 1024 * 1024) {
          setError(t("uploaderTooLarge", { name: file.name }));
          continue;
        }
        if (!file.type.startsWith("image/")) {
          setError(t("uploaderNotImage", { name: file.name }));
          continue;
        }
        const dataUrl = await readAsDataURL(file);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Data: dataUrl,
            filename: file.name,
            mimeType: file.type,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: t("uploaderFailed") }));
          throw new Error(err.error || t("uploaderFailed"));
        }
        const data = await res.json();
        uploaded.push({
          id: crypto.randomUUID(),
          uploadId: data.uploadId,
          url: data.url,
          filename: data.fileName || file.name,
          preview: dataUrl,
        });
      }
      if (uploaded.length > 0) {
        onChange([...images, ...uploaded]);
        onUpload?.(uploaded);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("uploaderFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeImage(id: string) {
    onChange(images.filter((i) => i.id !== id));
  }

  if (maxImages === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {images.map((img, i) => (
          <div
            key={img.id}
            className="relative group aspect-square rounded-[14px] overflow-hidden border border-[#E5E5E7]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.preview}
              alt={img.filename}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(img.id)}
              disabled={disabled}
              className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-white/90 text-[#1D1D1F] text-[12px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              ✕
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="aspect-square bg-white border border-dashed border-[#D2D2D7] hover:border-[#1D1D1F] rounded-[14px] transition-colors flex flex-col items-center justify-center gap-1 text-[#6E6E73] hover:text-[#1D1D1F] disabled:opacity-40"
          >
            {uploading ? (
              <div className="spinner" />
            ) : (
              <>
                <span className="text-[24px] font-light leading-none">+</span>
                <span className="text-[11px] tracking-[0.05em] uppercase font-medium">
                  {t("uploaderAdd")}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="mt-3 text-[12px] text-[#86868B] tabular">
        {t("uploaderCount", {
          count: String(images.length).padStart(2, "0"),
          max: String(maxImages).padStart(2, "0"),
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <p className="text-[12px] text-[#D70015] mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
