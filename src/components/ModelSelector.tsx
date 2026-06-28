"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  MODEL_GROUPS,
  MODELS,
  getModelGroupByModelId,
  type ModelCapability,
  type ModelId,
  type ModelInfo,
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

function capabilityLabel(t: ReturnType<typeof useTranslations>, capability: ModelCapability) {
  return capability === "text-to-image" ? t("t2i") : t("i2i");
}

export function ModelSelector({ value, onChange }: Props) {
  const t = useTranslations("model");
  const [open, setOpen] = useState(false);
  const current = MODELS[value];
  const currentGroup = getModelGroupByModelId(value);

  function selectGroup(groupSlug: string) {
    const group = MODEL_GROUPS.find((item) => item.slug === groupSlug);
    const nextModel = group?.capabilities[0];
    if (!nextModel) return;

    onChange(nextModel.id);
    setOpen(false);
  }

  return (
    <div className="relative space-y-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left p-5 sm:p-6 bg-[#F5F5F7] hover:bg-white border border-transparent hover:border-[#E5E5E7] rounded-[18px] transition-colors"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] tracking-[0.05em] uppercase text-[#6E6E73] font-medium">
              {PROVIDER_NAME[currentGroup.provider]}
            </span>
            <span className="text-[11px] text-[#86868B]">·</span>
            <span className="text-[11px] tracking-[0.05em] uppercase text-[#86868B] font-medium">
              {currentGroup.maxResolutionLabel}
            </span>
            {currentGroup.capabilities.map((model) => (
              <span
                key={model.id}
                className="text-[11px] bg-white text-[#6E6E73] px-2 py-0.5 rounded-full border border-[#E5E5E7]"
              >
                {capabilityLabel(t, model.capability)}
              </span>
            ))}
            {currentGroup.recommended && (
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
          {currentGroup.displayName}
        </div>
        <p className="text-[14px] text-[#6E6E73] leading-[1.4]">
          {t.raw("descriptions")[currentGroup.descriptionKey] as string}
        </p>
      </button>

      {currentGroup.capabilities.length > 1 && (
        <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-[#F5F5F7] p-1">
          {currentGroup.capabilities.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange(model.id)}
              className={cn(
                "h-10 rounded-[10px] text-[13px] transition-colors",
                model.id === current.id
                  ? "bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]",
              )}
            >
              {capabilityLabel(t, model.capability)}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-20 top-full mt-2 left-0 right-0 bg-white rounded-[18px] shadow-xl border border-[#E5E5E7] max-h-[60vh] overflow-y-auto">
          {MODEL_GROUPS.map((group) => (
            <button
              key={group.slug}
              type="button"
              onClick={() => selectGroup(group.slug)}
              className={cn(
                "w-full text-left px-5 py-4 border-b border-[#F5F5F7] hover:bg-[#F5F5F7] transition-colors last:border-b-0",
                group.slug === currentGroup.slug && "bg-[#F5F5F7]",
              )}
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[17px] font-medium text-[#1D1D1F]">
                  {group.displayName}
                </span>
                <span className="text-[11px] text-[#86868B]">·</span>
                <span className="text-[11px] tracking-[0.05em] uppercase text-[#86868B] font-medium">
                  {PROVIDER_NAME[group.provider]}
                </span>
                {group.capabilities.map((model) => (
                  <span
                    key={model.id}
                    className="text-[11px] bg-white text-[#6E6E73] px-2 py-0.5 rounded-full border border-[#E5E5E7]"
                  >
                    {capabilityLabel(t, model.capability)}
                  </span>
                ))}
                {group.recommended && (
                  <span className="text-[11px] bg-[#1D1D1F] text-white px-2 py-0.5 rounded-full">
                    {t("featured")}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[#6E6E73] line-clamp-2 leading-[1.4]">
                {t.raw("descriptions")[group.descriptionKey] as string}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
