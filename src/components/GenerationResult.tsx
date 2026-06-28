"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface GenerationOutput {
  resultUrls: string[];
  taskId?: string;
  costTime?: number;
  prompt?: string;
  model?: string;
  hasReferenceImage?: boolean;
}

interface Props {
  output: GenerationOutput | null;
  loading: boolean;
  error: string | null;
  prompt: string;
  model: string;
  createdAt?: Date | string;
  onRegenerate?: () => void;
  onDownloadResult?: (index: number, url: string) => void;
  onCopyResultUrl?: (index: number, url: string) => void;
}

export function GenerationResult({
  output,
  loading,
  error,
  prompt,
  model,
  onRegenerate,
  onDownloadResult,
  onCopyResultUrl,
}: Props) {
  const t = useTranslations("result");
  const tCommon = useTranslations("common");
  return (
    <div className="bg-white border border-[#E5E5E7] rounded-[18px] min-h-[600px] flex flex-col overflow-hidden">
      {/* Header */}
      {output && output.resultUrls.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E5E7]">
          <div className="text-[12px] tracking-[0.05em] uppercase text-[#86868B] font-medium">
            {t("result")}
          </div>
          <div className="text-[12px] text-[#1D1D1F] tabular">
            {t("prints", { count: output.resultUrls.length })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-5 sm:p-6 flex items-center justify-center">
        {loading && <LoadingState />}
        {error && <ErrorState error={error} onRegenerate={onRegenerate} />}
        {output && output.resultUrls.length > 0 && (
          <ResultDisplay
            output={output}
            prompt={prompt}
            model={model}
            onRegenerate={onRegenerate}
            onDownloadResult={onDownloadResult}
            onCopyResultUrl={onCopyResultUrl}
          />
        )}
        {!loading && !error && !output && <EmptyState />}
      </div>

      {/* Footer metadata */}
      {(output && output.resultUrls.length > 0) && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E5E7] text-[12px] text-[#86868B]">
          <span className="tabular">
            {output.costTime !== undefined
              ? `${(output.costTime / 1000).toFixed(1)}s`
              : "—"}
          </span>
          <span className="tabular truncate ml-2">
            {output.taskId ? output.taskId.slice(-8) : "—"}
          </span>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  const t = useTranslations("result");
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 w-full">
      <div className="spinner" style={{ width: 24, height: 24, color: "#1D1D1F" }} />
      <div className="text-center">
        <div className="text-[14px] text-[#0066CC] mb-2 font-medium">
          {t("exposing")}
        </div>
        <p className="text-[19px] text-[#6E6E73]">
          {t("generating")}
        </p>
        <p className="text-[13px] text-[#86868B] mt-2">
          {t("eta")}
        </p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRegenerate }: { error: string; onRegenerate?: () => void }) {
  const t = useTranslations("result");
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 w-full text-center">
      <div className="text-[14px] text-[#D70015] font-medium">
        {t("failed")}
      </div>
      <p className="text-[17px] text-[#1D1D1F] max-w-md leading-[1.4]">
        {error}
      </p>
      {onRegenerate && (
        <button onClick={onRegenerate} className="btn btn-secondary">
          {t("tryAgain")}
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("create");
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 w-full text-center">
      <div className="text-[12px] tracking-[0.05em] uppercase text-[#86868B] font-medium">
        {t("viewfinderAwaiting")}
      </div>
      <p className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] text-[#1D1D1F] max-w-md leading-[1.2]">
        {t("viewfinderCompose", { em: t("viewfinderComposeEm") })}
      </p>
    </div>
  );
}

function ResultDisplay({
  output,
  prompt,
  model,
  onRegenerate,
  onDownloadResult,
  onCopyResultUrl,
}: {
  output: GenerationOutput;
  prompt: string;
  model: string;
  onRegenerate?: () => void;
  onDownloadResult?: (index: number, url: string) => void;
  onCopyResultUrl?: (index: number, url: string) => void;
}) {
  const t = useTranslations("result");
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <div className="w-full">
      <div
        className={cn(
          "grid gap-3",
          output.resultUrls.length === 1
            ? "grid-cols-1"
            : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        {output.resultUrls.map((url, i) => (
          <div key={url + i} className="relative group rounded-[14px] overflow-hidden bg-[#F5F5F7]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${prompt} - ${i + 1}`}
              className="w-full h-auto cursor-pointer"
              onClick={() => setLightbox(url)}
            />
            <div className="absolute bottom-0 left-0 right-0 p-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="bg-white/95 backdrop-blur text-[#1D1D1F] text-[13px] py-2 px-4 rounded-full hover:bg-white flex-1 text-center"
                download
                onClick={() => onDownloadResult?.(i, url)}
              >
                {t("download")}
              </a>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await navigator.clipboard.writeText(url);
                    onCopyResultUrl?.(i, url);
                  } catch {
                    // Keep the existing no-UI-error behavior, but do not report a success event.
                  }
                }}
                className="bg-white/95 backdrop-blur text-[#1D1D1F] text-[13px] py-2 px-4 rounded-full hover:bg-white"
              >
                {t("copyUrl")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[#E5E5E7] flex items-center justify-between text-[12px]">
        <span className="text-[#86868B] truncate">
          {model}
        </span>
        {onRegenerate && (
          <button onClick={onRegenerate} className="text-[#0066CC] hover:underline">
            {t("reexpose")}
          </button>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-white/95 flex items-center justify-center p-6 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-[13px] text-[#1D1D1F] hover:opacity-70"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            {t("close")} ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
