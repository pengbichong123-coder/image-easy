"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ALL_MODELS,
  type ModelId,
  type ModelInfo,
  MODELS,
  isImageToImageModel,
} from "@/lib/models";
import { cn } from "@/lib/utils";

interface Props {
  value: ModelId;
  onChange: (model: ModelId) => void;
}

const PROVIDER_NAME: Record<ModelInfo["provider"], string> = {
  openai: "OpenAI",
  bytedance: "ByteDance",
  google: "Google",
};

export function ModelSelector({ value, onChange }: Props) {
  const t = useTranslations("model");
  const [open, setOpen] = useState(false);
  const current = MODELS[value];

  const groups: { capability: "text-to-image" | "image-to-image"; models: ModelInfo[] }[] = [
    {
      capability: "text-to-image",
      models: ALL_MODELS.filter((m) => m.capability === "text-to-image"),
    },
    {
      capability: "image-to-image",
      models: ALL_MODELS.filter((m) => m.capability === "image-to-image"),
    },
  ];

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left p-5 sm:p-6 bg-[#F5F5F7] hover:bg-white border border-transparent hover:border-[#E5E5E7] rounded-[18px] transition-colors"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] tracking-[0.05em] uppercase text-[#6E6E73] font-medium">
              {PROVIDER_NAME[current.provider]}
            </span>
            <span className="text-[11px] text-[#86868B]">·</span>
            <span className="text-[11px] tracking-[0.05em] uppercase text-[#86868B] font-medium">
              {isImageToImageModel(current.id) ? "I2I" : "T2I"}
            </span>
            {current.recommended && (
              <span className="text-[11px] bg-[#1D1D1F] text-white px-2 py-0.5 rounded-full">
                {t("featured")}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[12px] text-[#86868B] transition-transform mt-1",
              open && "rotate-180",
            )}
          >
            ▾
          </span>
        </div>
        <div className="text-[24px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#1D1D1F] mb-1">
          {current.displayName}
        </div>
        <p className="text-[14px] text-[#6E6E73] leading-[1.4]">
          {t.raw("descriptions")[current.descriptionKey] as string}
        </p>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 top-full mt-2 left-0 right-0 bg-white rounded-[18px] shadow-xl border border-[#E5E5E7] max-h-[60vh] overflow-y-auto">
          {groups.map((g) => (
            <div key={g.capability}>
              <div className="px-5 py-2 border-b border-[#E5E5E7] text-[11px] tracking-[0.05em] uppercase text-[#86868B] bg-[#FAFAFA] font-medium">
                {g.capability === "text-to-image" ? t("t2i") : t("i2i")}
              </div>
              {g.models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-5 py-4 border-b border-[#F5F5F7] hover:bg-[#F5F5F7] transition-colors last:border-b-0",
                    m.id === value && "bg-[#F5F5F7]",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[17px] font-medium text-[#1D1D1F]">
                      {m.displayName}
                    </span>
                    <span className="text-[11px] text-[#86868B]">·</span>
                    <span className="text-[11px] tracking-[0.05em] uppercase text-[#86868B] font-medium">
                      {PROVIDER_NAME[m.provider]}
                    </span>
                    {m.recommended && (
                      <span className="text-[11px] bg-[#1D1D1F] text-white px-2 py-0.5 rounded-full">
                        {t("featured")}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#6E6E73] line-clamp-2 leading-[1.4]">
                    {t.raw("descriptions")[m.descriptionKey] as string}
                  </p>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
