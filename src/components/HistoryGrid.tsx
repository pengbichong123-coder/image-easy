"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MODELS,
  getModelGroupByModelId,
  type ModelCapability,
  type ModelId,
  type ModelInfo,
} from "@/lib/models";
import { formatDate } from "@/lib/utils";

export interface HistoryItem {
  id: string;
  model: ModelId;
  prompt: string;
  aspectRatio?: string | null;
  resolution?: string | null;
  quality?: string | null;
  outputFormat?: string | null;
  status: string;
  resultUrls: string[];
  errorMessage?: string | null;
  createdAt: string | Date;
  upload?: { id: string; url: string; filename: string } | null;
}

interface Props {
  items: HistoryItem[];
  onDelete?: (id: string) => void;
  onReuse?: (item: HistoryItem) => void;
  onDetails?: (item: HistoryItem) => void;
  emptyText?: string;
}

export function HistoryGrid({ items, onDelete, onReuse, onDetails, emptyText }: Props) {
  const t = useTranslations("archive");
  const resolvedEmpty = emptyText ?? t("emptyText");
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-[#D2D2D7] rounded-[18px] py-24 text-center bg-[#FAFAFA]">
        <div className="text-[12px] tracking-[0.05em] uppercase text-[#86868B] mb-3 font-medium">
          {t("emptyKicker")}
        </div>
        <p className="text-[19px] text-[#6E6E73] max-w-md mx-auto leading-[1.4]">
          {resolvedEmpty}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {items.map((item) => (
        <HistoryCard key={item.id} item={item} onDelete={onDelete} onReuse={onReuse} onDetails={onDetails} />
      ))}
    </div>
  );
}

function HistoryCard({
  item,
  onDelete,
  onReuse,
  onDetails,
}: {
  item: HistoryItem;
  onDelete?: (id: string) => void;
  onReuse?: (item: HistoryItem) => void;
  onDetails?: (item: HistoryItem) => void;
}) {
  const t = useTranslations("archive");
  const tCommon = useTranslations("common");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptOverflows, setPromptOverflows] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const model = MODELS[item.model];
  const modelGroup = getModelGroupByModelId(item.model);
  const modelLabel = modelGroup.displayName || model?.displayName || item.model;
  const firstImage = item.resultUrls[0];

  // Detect whether the prompt actually needs more than 2 lines so we
  // don't show a useless "…more" button on short prompts.
  const promptRef = useRef<HTMLParagraphElement | null>(null);
  useLayoutEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    // Compare clamped vs unclamped heights: when line-clamp-2 is active,
    // scrollHeight > clientHeight ⇒ the content overflows 2 lines.
    setPromptOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [item.prompt]);

  return (
    <article className="group flex flex-col h-full min-w-0">
      {item.status === "completed" && firstImage ? (
        <>
          <div className="rounded-[14px] overflow-hidden bg-[#F5F5F7] aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firstImage}
              alt={item.prompt}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightbox(firstImage)}
            />
          </div>
          {lightbox && (
            <div
              className="fixed inset-0 z-[100] bg-white/95 flex items-center justify-center p-6 cursor-pointer"
              onClick={() => setLightbox(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </>
      ) : item.status === "processing" || item.status === "pending" ? (
        <div className="aspect-square rounded-[14px] bg-[#F5F5F7] flex flex-col items-center justify-center gap-2">
          <div className="spinner" style={{ width: 18, height: 18 }} />
          <span className="text-[12px] text-[#6E6E73]">{tCommon("generating")}</span>
        </div>
      ) : item.status === "failed" ? (
        <div className="aspect-square rounded-[14px] bg-[#F5F5F7] flex flex-col items-center justify-center gap-2 p-4 text-center overflow-hidden">
          <span className="text-[12px] text-[#D70015] font-medium">{tCommon("failed")}</span>
          <span className="block max-w-full text-[11px] text-[#86868B] line-clamp-3 leading-[1.4] break-words [overflow-wrap:anywhere]">
            {item.errorMessage || t("unknownError")}
          </span>
        </div>
      ) : null}

      {/* Caption — flex-col + flex-1 + mt-auto on actions keeps the
          Discard / Reuse / Save row aligned across cards regardless of
          prompt length or which buttons are present. */}
      <div className="mt-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-1 min-w-0">
          <span className="min-w-0 text-[12px] tracking-[0.05em] uppercase text-[#86868B] font-medium truncate">
            {modelLabel}
          </span>
          <span className="shrink-0 text-[11px] text-[#86868B] tabular">
            {formatDate(item.createdAt)}
          </span>
        </div>
        {/* Reserved height for 2-line prompt so shorter prompts don't
            collapse the card and shift the action row upward. The clamp
            is removed when expanded; grid stretch keeps the row aligned. */}
        <p
          ref={promptRef}
          className={[
            "text-[13px] text-[#6E6E73] leading-[1.4] min-h-[2.8em] break-words [overflow-wrap:anywhere]",
            promptExpanded ? "" : "line-clamp-2",
          ].join(" ")}
        >
          &ldquo;{item.prompt}&rdquo;
          {promptOverflows && (
            <button
              type="button"
              onClick={() => setPromptExpanded((v) => !v)}
              className="ml-1 text-[#86868B] hover:text-[#0066CC] align-baseline"
            >
              {promptExpanded ? tCommon("less") : tCommon("more")}
            </button>
          )}
        </p>
        {(onReuse || onDelete) && (
          <div className="flex items-center gap-3 mt-auto pt-3 min-h-[28px]">
            {onReuse && item.status === "completed" && (
              <button
                onClick={() => onReuse(item)}
                className="text-[12px] text-[#0066CC] hover:underline"
              >
                {tCommon("reuse")}
              </button>
            )}
            {firstImage && (
              <a
                href={firstImage}
                target="_blank"
                rel="noreferrer"
                download
                className="text-[12px] text-[#0066CC] hover:underline"
              >
                {tCommon("save")}
              </a>
            )}
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="text-[12px] text-[#86868B] hover:text-[#0066CC] hover:underline"
            >
              {tCommon("details")}
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(item.id)}
                className="text-[12px] text-[#D70015] hover:underline ml-auto"
              >
                {tCommon("discard")}
              </button>
            )}
          </div>
        )}
      </div>

      {detailsOpen && (
        <DetailsDialog
          item={item}
          model={model}
          modelLabel={modelLabel}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </article>
  );
}

function DetailsDialog({
  item,
  model,
  modelLabel,
  onClose,
}: {
  item: HistoryItem;
  model: ModelInfo | undefined;
  modelLabel: string;
  onClose: () => void;
}) {
  const t = useTranslations("archive");
  const tModel = useTranslations("model");
  const capabilityText = model ? capabilityLabel(tModel, model.capability) : null;

  // Esc to close — small QoL nicety.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const paramRows: Array<[string, string | null | undefined]> = [
    [t("fieldModel"), capabilityText ? `${modelLabel} · ${capabilityText}` : modelLabel],
    [t("fieldStatus"), item.status],
    [t("fieldCreated"), formatDate(item.createdAt)],
    [t("fieldAspectRatio"), item.aspectRatio],
    [t("fieldResolution"), item.resolution],
    [t("fieldQuality"), item.quality],
    [t("fieldOutputFormat"), item.outputFormat],
  ];

  return (
    <div
      className="fixed inset-0 z-[100] bg-white/95 flex items-center justify-center p-6 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[18px] border border-[#E5E5E7] max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 sm:p-8 cursor-auto shadow-[0_24px_60px_rgba(0,0,0,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6 mb-5">
          <div className="text-[12px] tracking-[0.05em] uppercase text-[#86868B] font-medium">
            {t("modalTitle")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-[#86868B] hover:text-[#1D1D1F]"
            aria-label={t("modalClose")}
          >
            ✕
          </button>
        </div>

        {item.resultUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.resultUrls[0]}
            alt={item.prompt}
            className="w-full max-h-[320px] object-contain rounded-[14px] bg-[#F5F5F7] mb-6"
          />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-6 pb-6 border-b border-[#E5E5E7]">
          {paramRows.map(([k, v]) => (
            <div key={k}>
              <div className="text-[11px] tracking-[0.05em] uppercase text-[#86868B] mb-1">
                {k}
              </div>
              <div className="text-[13px] text-[#1D1D1F]">
                {v || <span className="text-[#86868B]">{t("fieldEmpty")}</span>}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="text-[11px] tracking-[0.05em] uppercase text-[#86868B] mb-2">
            {t("modalPrompt")}
          </div>
          <p className="text-[14px] text-[#1D1D1F] leading-[1.5] whitespace-pre-wrap break-words">
            {item.prompt}
          </p>
        </div>

        {item.errorMessage && (
          <div className="mt-6">
            <div className="text-[11px] tracking-[0.05em] uppercase text-[#D70015] mb-2">
              {t("modalError")}
            </div>
            <p className="text-[13px] text-[#D70015] leading-[1.5] break-words [overflow-wrap:anywhere]">
              {item.errorMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function capabilityLabel(t: ReturnType<typeof useTranslations>, capability: ModelCapability) {
  return capability === "text-to-image" ? t("t2i") : t("i2i");
}
