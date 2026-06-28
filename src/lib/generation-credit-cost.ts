import type { AspectRatio, ModelId, OutputFormat, Quality, Resolution } from "./models";
import { normalizeModelParams } from "./models";

export type GenerationCreditCostInput = {
  model: ModelId;
  aspectRatio?: AspectRatio | null;
  resolution?: Resolution | null;
  quality?: Quality | null;
  outputFormat?: OutputFormat | null;
};

export type GenerationCreditCostRecord = {
  model: string;
  aspectRatio?: string | null;
  resolution?: string | null;
  quality?: string | null;
  outputFormat?: string | null;
};

export const GENERATION_CREDIT_COST_ROWS = [
  { model: "GPT Image 2", spec: "1K", credits: 3 },
  { model: "GPT Image 2", spec: "2K", credits: 5 },
  { model: "GPT Image 2", spec: "4K", credits: 8 },
  { model: "Seedream 4.5", spec: "Text to image / Image to image", credits: 7 },
  { model: "Nano Banana Pro", spec: "1K / 2K", credits: 8 },
  { model: "Nano Banana Pro", spec: "4K", credits: 14 },
] as const;

function isModelId(value: string): value is ModelId {
  return [
    "gpt-image-2-text-to-image",
    "gpt-image-2-image-to-image",
    "seedream-4-5-text-to-image",
    "seedream-4-5-edit",
    "nano-banana-pro",
  ].includes(value);
}

function normalizedResolution(input: GenerationCreditCostInput) {
  return normalizeModelParams(input.model, {
    aspectRatio: input.aspectRatio ?? undefined,
    resolution: input.resolution ?? undefined,
    quality: input.quality ?? undefined,
    outputFormat: input.outputFormat ?? undefined,
  }).resolution;
}

export function getGenerationCreditCost(input: GenerationCreditCostInput) {
  if (input.model === "seedream-4-5-text-to-image" || input.model === "seedream-4-5-edit") {
    return 7;
  }

  const resolution = normalizedResolution(input);

  if (input.model === "nano-banana-pro") {
    return resolution === "4K" ? 14 : 8;
  }

  if (resolution === "4K") return 8;
  if (resolution === "2K") return 5;
  return 3;
}

export function getGenerationCreditCostForRecord(record: GenerationCreditCostRecord) {
  if (!isModelId(record.model)) {
    return 1;
  }

  return getGenerationCreditCost({
    model: record.model,
    aspectRatio: record.aspectRatio as AspectRatio | null | undefined,
    resolution: record.resolution as Resolution | null | undefined,
    quality: record.quality as Quality | null | undefined,
    outputFormat: record.outputFormat as OutputFormat | null | undefined,
  });
}
