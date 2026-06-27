"use client";

import { useTranslations } from "next-intl";
import { MODELS } from "@/lib/models";
import type {
  AspectRatio,
  Resolution,
  Quality,
  OutputFormat,
} from "@/lib/models";
import { cn } from "@/lib/utils";

interface Props {
  modelId: string;
  aspectRatio: AspectRatio | undefined;
  resolution: Resolution | undefined;
  quality: Quality | undefined;
  outputFormat: OutputFormat | undefined;
  nsfwChecker: boolean;
  onAspectRatioChange: (v: AspectRatio | undefined) => void;
  onResolutionChange: (v: Resolution | undefined) => void;
  onQualityChange: (v: Quality | undefined) => void;
  onOutputFormatChange: (v: OutputFormat | undefined) => void;
  onNsfwCheckerChange: (v: boolean) => void;
}

export function ModelParams({
  modelId,
  aspectRatio,
  resolution,
  quality,
  outputFormat,
  nsfwChecker,
  onAspectRatioChange,
  onResolutionChange,
  onQualityChange,
  onOutputFormatChange,
  onNsfwCheckerChange,
}: Props) {
  const t = useTranslations("params");
  const tCommon = useTranslations("common");
  const model = MODELS[modelId as keyof typeof MODELS];
  if (!model) return null;

  const hasAny =
    model.supportsAspectRatio ||
    model.supportsResolution ||
    model.supportsQuality ||
    model.supportsOutputFormat ||
    model.supportsNsfwChecker;

  if (!hasAny) {
    return (
      <p className="text-[13px] text-[#6E6E73]">
        {tCommon("noExtraParams")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {model.supportsAspectRatio && (
        <ParamGroup label={t("aspectRatio")}>
          <div className="flex flex-wrap gap-2">
            {model.aspectRatioOptions.map((ar) => (
              <button
                key={ar}
                type="button"
                onClick={() => onAspectRatioChange(ar)}
                className={cn(
                  "min-w-[48px] px-3 py-1.5 text-[13px] rounded-full transition-colors",
                  aspectRatio === ar
                    ? "bg-[#1D1D1F] text-white"
                    : "bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:border-[#1D1D1F]",
                )}
              >
                {ar}
              </button>
            ))}
          </div>
        </ParamGroup>
      )}

      {model.supportsResolution && (
        <ParamGroup label={t("resolution")}>
          <div className="flex gap-2">
            {model.resolutionOptions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onResolutionChange(r)}
                className={cn(
                  "px-4 py-1.5 text-[13px] rounded-full transition-colors",
                  resolution === r
                    ? "bg-[#1D1D1F] text-white"
                    : "bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:border-[#1D1D1F]",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-[#86868B] mt-2">
            {t("resolutionHint")}
          </p>
        </ParamGroup>
      )}

      {model.supportsQuality && (
        <ParamGroup label={t("quality")}>
          <div className="flex gap-2">
            {model.qualityOptions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQualityChange(q)}
                className={cn(
                  "px-4 py-1.5 text-[13px] rounded-full transition-colors",
                  quality === q
                    ? "bg-[#1D1D1F] text-white"
                    : "bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:border-[#1D1D1F]",
                )}
              >
                {q === "basic" ? t("qualityStandard") : t("qualityHigh")}
              </button>
            ))}
          </div>
        </ParamGroup>
      )}

      {model.supportsOutputFormat && (
        <ParamGroup label={t("format")}>
          <div className="flex gap-2">
            {model.outputFormatOptions.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onOutputFormatChange(f)}
                className={cn(
                  "px-4 py-1.5 text-[13px] uppercase rounded-full transition-colors",
                  outputFormat === f
                    ? "bg-[#1D1D1F] text-white"
                    : "bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:border-[#1D1D1F]",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </ParamGroup>
      )}

      {model.supportsNsfwChecker && (
        <ParamGroup label={t("safety")}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={nsfwChecker}
              onChange={(e) => onNsfwCheckerChange(e.target.checked)}
              className="w-4 h-4 rounded border-[#D2D2D7] text-[#0066CC] focus:ring-[#0066CC] focus:ring-offset-0"
            />
            <span className="text-[13px] text-[#1D1D1F]">
              {t("nsfwChecker")}
            </span>
          </label>
        </ParamGroup>
      )}
    </div>
  );
}

function ParamGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[12px] tracking-[0.05em] uppercase text-[#86868B] mb-3 font-medium">
        {label}
      </div>
      {children}
    </div>
  );
}
