"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { ModelSelector } from "@/components/ModelSelector";
import { ModelParams } from "@/components/ModelParams";
import { PromptInput } from "@/components/PromptInput";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { GenerationResult, type GenerationOutput } from "@/components/GenerationResult";
import { trackEvent, type AnalyticsParams } from "@/lib/analytics";
import {
  MODELS,
  type ModelId,
  type AspectRatio,
  type Resolution,
  type Quality,
  type OutputFormat,
  isImageToImageModel,
} from "@/lib/models";

export function CreateContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("create");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");

  // Form state
  const [modelId, setModelId] = useState<ModelId>("gpt-image-2-text-to-image");
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio | undefined>("1:1");
  const [resolution, setResolution] = useState<Resolution | undefined>("1K");
  const [quality, setQuality] = useState<Quality | undefined>("basic");
  const [outputFormat, setOutputFormat] = useState<OutputFormat | undefined>("png");
  const [nsfwChecker, setNsfwChecker] = useState(false);

  // Result state
  const [output, setOutput] = useState<GenerationOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelInfo = MODELS[modelId];

  function commonAnalyticsParams(
    status: string,
    model: ModelId = modelId,
    hasReferenceImage = images.length > 0,
  ): AnalyticsParams {
    return {
      model,
      capability: MODELS[model].capability,
      locale,
      has_reference_image: hasReferenceImage,
      status,
    };
  }

  function handleModelChange(nextModelId: ModelId) {
    if (nextModelId !== modelId) {
      trackEvent("select_model", commonAnalyticsParams("selected", nextModelId));
    }
    setModelId(nextModelId);
  }

  function handleUpload(uploaded: UploadedImage[]) {
    trackEvent("upload_image", {
      ...commonAnalyticsParams("uploaded", modelId, images.length + uploaded.length > 0),
      image_count: uploaded.length,
      total_image_count: images.length + uploaded.length,
    });
  }

  function trackResultAction(name: "download_result" | "copy_result_url", index: number) {
    trackEvent(name, {
      ...commonAnalyticsParams(name === "download_result" ? "downloaded" : "copied"),
      result_index: index,
    });
  }

  // Load model from query string
  useEffect(() => {
    const m = searchParams.get("model");
    if (m && m in MODELS) setModelId(m as ModelId);
  }, [searchParams]);

  // Reuse from history
  useEffect(() => {
    const reuseId = searchParams.get("reuse");
    if (!reuseId) return;
    fetch("/api/history?limit=50")
      .then((r) => r.json())
      .then((data) => {
        const item = data.items?.find(
          (i: { id: string; model: string; prompt: string; aspectRatio?: string; resolution?: string; quality?: string; outputFormat?: string; resultUrls?: string[] }) =>
            i.id === reuseId,
        );
        if (!item) return;
        setModelId(item.model as ModelId);
        setPrompt(item.prompt);
        if (item.aspectRatio) setAspectRatio(item.aspectRatio as AspectRatio);
        if (item.resolution) setResolution(item.resolution as Resolution);
        if (item.quality) setQuality(item.quality as Quality);
        if (item.outputFormat) setOutputFormat(item.outputFormat as OutputFormat);

        if (isImageToImageModel(item.model as ModelId) && item.resultUrls?.[0]) {
          const refUrl = item.resultUrls[0];
          setImages([
            {
              id: `reuse-${reuseId}-0`,
              url: refUrl,
              filename: "Reference from previous result",
              preview: refUrl,
            },
          ]);
        }
        trackEvent("reuse_prompt", {
          ...commonAnalyticsParams(
            "loaded",
            item.model as ModelId,
            isImageToImageModel(item.model as ModelId) && Boolean(item.resultUrls?.[0]),
          ),
          reuse_id: reuseId,
        });
      })
      .catch(() => {});
  }, [searchParams]);

  // Reset params not supported by current model
  useEffect(() => {
    if (!modelInfo.supportsAspectRatio) setAspectRatio(undefined);
    if (!modelInfo.supportsResolution) setResolution(undefined);
    if (!modelInfo.supportsQuality) setQuality(undefined);
    if (!modelInfo.supportsOutputFormat) setOutputFormat(undefined);
  }, [modelId, modelInfo]);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <div className="text-[14px] text-[#6E6E73] mb-4">
          {tAuth("membersOnlyKicker")}
        </div>
        <h1 className="display text-[56px] sm:text-[72px] text-[#1D1D1F] mb-5 leading-[1.05]">
          {tAuth("loginTitleA")}
          <br />
          <span className="display-em text-[#0066CC]">{tAuth("loginTitleEm")}</span>
          {tAuth("loginTitleB")}
        </h1>
        <p className="text-[19px] text-[#6E6E73] mb-8">
          {tAuth("loginLead")}
        </p>
        <button
          onClick={() => router.push("/login?callbackUrl=/create")}
          className="btn btn-primary"
        >
          {tAuth("loginButton")}
        </button>
      </div>
    );
  }

  async function handleSubmit() {
    if (!prompt.trim()) return;
    if (isImageToImageModel(modelId) && images.length === 0) {
      setError(t("errorRequiresImage"));
      return;
    }
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      trackEvent("submit_generation", commonAnalyticsParams("submitted"));
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          prompt: prompt.trim(),
          aspectRatio: aspectRatio,
          resolution: resolution,
          quality: quality,
          outputFormat: outputFormat,
          uploadIds: images.filter((i) => i.uploadId).map((i) => i.uploadId!),
          imageUrls: images.filter((i) => !i.uploadId).map((i) => i.url),
          nsfwChecker: nsfwChecker || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("errorFailed") }));
        throw new Error(err.error || t("errorFailed"));
      }
      const data = await res.json();
      const completed = await pollGeneration(data.id);
      trackEvent("generation_completed", {
        ...commonAnalyticsParams("completed"),
        task_id: completed.taskId || data.id,
        result_count: completed.resultUrls?.length || 0,
        cost_time: completed.costTime,
      });
      setOutput({
        resultUrls: completed.resultUrls || [],
        taskId: completed.taskId,
        costTime: completed.costTime,
        prompt: prompt.trim(),
        model: modelId,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : tCommon("error");
      trackEvent("generation_failed", {
        ...commonAnalyticsParams("failed"),
        error_message: message,
      });
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    prompt.trim().length > 0 &&
    prompt.length <= modelInfo.maxPromptLength &&
    (!isImageToImageModel(modelId) || images.length > 0);

  return (
    <div className="max-w-[1280px] mx-auto px-5 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 sm:mb-12">
        <div className="text-[14px] text-[#6E6E73] mb-3">{t("kicker")}</div>
        <h1 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-3 leading-[1.05]">
          {t("titleA")} <span className="display-em text-[#0066CC]">{t("titleEm")}</span>
          {t("titleB")}
        </h1>
        <p className="text-[17px] text-[#6E6E73] max-w-xl">
          {t("lead")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* LEFT — Composition */}
        <div className="lg:col-span-5 space-y-10">
          {/* 01 — Instrument */}
          <section>
            <SectionLabel num={t("section1Num")} label={t("section1Label")} />
            <ModelSelector value={modelId} onChange={handleModelChange} />
          </section>

          {/* 02 — References (only for I2I) */}
          {isImageToImageModel(modelId) && (
            <section>
              <SectionLabel num={t("section2Num")} label={t("section2Label")} />
              <div className="bg-[#F5F5F7] rounded-[18px] p-5">
                <ImageUploader
                  images={images}
                  onChange={setImages}
                  maxImages={modelInfo.maxInputImages}
                  disabled={loading}
                  onUpload={handleUpload}
                />
                {images.length === 0 && (
                  <p className="text-[12px] text-[#86868B] mt-3 pt-3 border-t border-[#E5E5E7]">
                    {t("uploaderHint", { max: modelInfo.maxInputImages })}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* 03 — Prompt */}
          <section>
            <SectionLabel
              num={isImageToImageModel(modelId) ? t("section3Num") : t("section2Num")}
              label={t("section3Label")}
            />
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              maxLength={modelInfo.maxPromptLength}
              placeholder={
                isImageToImageModel(modelId)
                  ? t("promptPlaceholderI2I")
                  : t("promptPlaceholderT2I")
              }
              disabled={loading}
              onSubmit={handleSubmit}
              canSubmit={canSubmit}
              submitting={loading}
            />
          </section>

          {/* 04 — Settings */}
          <section>
            <SectionLabel
              num={isImageToImageModel(modelId) ? t("section4Num") : t("section3Num")}
              label={t("section4Label")}
            />
            <div className="bg-[#F5F5F7] rounded-[18px] p-5">
              <ModelParams
                modelId={modelId}
                aspectRatio={aspectRatio}
                resolution={resolution}
                quality={quality}
                outputFormat={outputFormat}
                nsfwChecker={nsfwChecker}
                onAspectRatioChange={setAspectRatio}
                onResolutionChange={setResolution}
                onQualityChange={setQuality}
                onOutputFormatChange={setOutputFormat}
                onNsfwCheckerChange={setNsfwChecker}
              />
            </div>
          </section>
        </div>

        {/* RIGHT — Lightbox (sticky) */}
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-20">
            <SectionLabel num="—" label={t("viewfinder")} />
            <GenerationResult
              output={output}
              loading={loading}
              error={error}
              prompt={prompt}
              model={modelId}
              onRegenerate={canSubmit ? handleSubmit : undefined}
              onDownloadResult={(index) => trackResultAction("download_result", index)}
              onCopyResultUrl={(index) => trackResultAction("copy_result_url", index)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

async function pollGeneration(id: string) {
  let interval = 2000;
  const deadline = Date.now() + 15 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval));

    const res = await fetch(`/api/generate/${id}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok && data.status !== "failed") {
      throw new Error(data.error || "Generation failed");
    }

    if (data.status === "completed") return data;
    if (data.status === "failed") {
      throw new Error(data.errorMessage || "Generation failed");
    }

    interval = Math.min(Math.round(interval * 1.5), 10000);
  }

  throw new Error("Generation timed out");
}

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <span className="text-[15px] font-medium text-[#0066CC] tabular">{num}</span>
      <span className="text-[12px] tracking-[0.05em] uppercase text-[#86868B] font-medium">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#E5E5E7]" />
    </div>
  );
}
