// Model definitions and shared types
export type AspectRatio =
  | "auto"
  | "1:1"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4"
  | "5:4"
  | "4:5"
  | "16:9"
  | "9:16"
  | "2:1"
  | "1:2"
  | "3:1"
  | "1:3"
  | "21:9"
  | "9:21";

export type Resolution = "1K" | "2K" | "4K";
export type Quality = "basic" | "high";
export type OutputFormat = "png" | "jpg";

export type ModelId =
  | "gpt-image-2-text-to-image"
  | "gpt-image-2-image-to-image"
  | "seedream-4-5-text-to-image"
  | "seedream-4-5-edit"
  | "nano-banana-pro";

export type ModelCapability = "text-to-image" | "image-to-image";

export interface ModelInfo {
  id: ModelId;
  kieModel: string;
  modelSlug: string;
  name: string;
  displayName: string;
  // Provider is i18n-agnostic — kept as a stable machine key.
  provider: "openai" | "bytedance" | "google";
  capability: ModelCapability;
  // i18n key under messages.<locale>.model.descriptions.<id>
  descriptionKey: string;
  // Supported parameters
  supportsAspectRatio: boolean;
  aspectRatioOptions: AspectRatio[];
  supportsResolution: boolean;
  resolutionOptions: Resolution[];
  supportsQuality: boolean;
  qualityOptions: Quality[];
  supportsOutputFormat: boolean;
  outputFormatOptions: OutputFormat[];
  supportsNsfwChecker: boolean;
  maxPromptLength: number;
  maxInputImages: number;
  maxImageSizeMB: number;
  recommended: boolean;
}

export interface ModelGroup {
  slug: string;
  displayName: string;
  provider: ModelInfo["provider"];
  recommended: boolean;
  maxResolutionLabel: string;
  descriptionKey: string;
  capabilities: ModelInfo[];
}

export const MODELS: Record<ModelId, ModelInfo> = {
  "gpt-image-2-text-to-image": {
    id: "gpt-image-2-text-to-image",
    kieModel: "gpt-image-2-text-to-image",
    modelSlug: "gpt-image-2",
    name: "GPT Image 2",
    displayName: "GPT Image 2",
    capability: "text-to-image",
    descriptionKey: "gpt-image-2-text-to-image",
    provider: "openai",
    supportsAspectRatio: true,
    aspectRatioOptions: [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "5:4",
      "4:5",
      "16:9",
      "9:16",
      "2:1",
      "1:2",
      "3:1",
      "1:3",
      "21:9",
      "9:21",
    ],
    supportsResolution: true,
    resolutionOptions: ["1K", "2K", "4K"],
    supportsQuality: false,
    qualityOptions: [],
    supportsOutputFormat: false,
    outputFormatOptions: [],
    supportsNsfwChecker: false,
    maxPromptLength: 20000,
    maxInputImages: 0,
    maxImageSizeMB: 0,
    recommended: true,
  },
  "gpt-image-2-image-to-image": {
    id: "gpt-image-2-image-to-image",
    kieModel: "gpt-image-2-image-to-image",
    modelSlug: "gpt-image-2",
    name: "GPT Image 2 (i2i)",
    displayName: "GPT Image 2 (Edit)",
    capability: "image-to-image",
    descriptionKey: "gpt-image-2-image-to-image",
    provider: "openai",
    supportsAspectRatio: true,
    aspectRatioOptions: [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "5:4",
      "4:5",
      "16:9",
      "9:16",
      "2:1",
      "1:2",
      "3:1",
      "1:3",
      "21:9",
      "9:21",
    ],
    supportsResolution: true,
    resolutionOptions: ["1K", "2K", "4K"],
    supportsQuality: false,
    qualityOptions: [],
    supportsOutputFormat: false,
    outputFormatOptions: [],
    supportsNsfwChecker: false,
    maxPromptLength: 20000,
    maxInputImages: 16,
    maxImageSizeMB: 30,
    recommended: true,
  },
  "seedream-4-5-text-to-image": {
    id: "seedream-4-5-text-to-image",
    kieModel: "seedream/4.5-text-to-image",
    modelSlug: "seedream-4-5",
    name: "Seedream 4.5",
    displayName: "Seedream 4.5",
    capability: "text-to-image",
    descriptionKey: "seedream-4-5-text-to-image",
    provider: "bytedance",
    supportsAspectRatio: true,
    aspectRatioOptions: [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "2:3",
      "3:2",
      "21:9",
    ],
    supportsResolution: false,
    resolutionOptions: [],
    supportsQuality: true,
    qualityOptions: ["basic", "high"],
    supportsOutputFormat: false,
    outputFormatOptions: [],
    supportsNsfwChecker: true,
    maxPromptLength: 3000,
    maxInputImages: 0,
    maxImageSizeMB: 0,
    recommended: false,
  },
  "seedream-4-5-edit": {
    id: "seedream-4-5-edit",
    kieModel: "seedream/4.5-edit",
    modelSlug: "seedream-4-5",
    name: "Seedream 4.5 (Edit)",
    displayName: "Seedream 4.5 (Edit)",
    capability: "image-to-image",
    descriptionKey: "seedream-4-5-edit",
    provider: "bytedance",
    supportsAspectRatio: true,
    aspectRatioOptions: [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "2:3",
      "3:2",
      "21:9",
    ],
    supportsResolution: false,
    resolutionOptions: [],
    supportsQuality: true,
    qualityOptions: ["basic", "high"],
    supportsOutputFormat: false,
    outputFormatOptions: [],
    supportsNsfwChecker: true,
    maxPromptLength: 3000,
    maxInputImages: 14,
    maxImageSizeMB: 10,
    recommended: false,
  },
  "nano-banana-pro": {
    id: "nano-banana-pro",
    kieModel: "nano-banana-pro",
    modelSlug: "nano-banana-pro",
    name: "Nano Banana Pro",
    displayName: "Nano Banana Pro",
    capability: "image-to-image",
    descriptionKey: "nano-banana-pro",
    provider: "google",
    supportsAspectRatio: true,
    aspectRatioOptions: [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9",
      "auto",
    ],
    supportsResolution: true,
    resolutionOptions: ["1K", "2K", "4K"],
    supportsQuality: false,
    qualityOptions: [],
    supportsOutputFormat: true,
    outputFormatOptions: ["png", "jpg"],
    supportsNsfwChecker: false,
    maxPromptLength: 10000,
    maxInputImages: 8,
    maxImageSizeMB: 30,
    recommended: true,
  },
};

export const ALL_MODELS: ModelInfo[] = Object.values(MODELS);

export const MODEL_GROUPS: ModelGroup[] = [
  {
    slug: "gpt-image-2",
    displayName: "GPT Image 2",
    provider: "openai",
    recommended: true,
    maxResolutionLabel: "4K",
    descriptionKey: "gpt-image-2-text-to-image",
    capabilities: [MODELS["gpt-image-2-text-to-image"], MODELS["gpt-image-2-image-to-image"]],
  },
  {
    slug: "seedream-4-5",
    displayName: "Seedream 4.5",
    provider: "bytedance",
    recommended: false,
    maxResolutionLabel: "4K",
    descriptionKey: "seedream-4-5-text-to-image",
    capabilities: [MODELS["seedream-4-5-text-to-image"], MODELS["seedream-4-5-edit"]],
  },
  {
    slug: "nano-banana-pro",
    displayName: "Nano Banana Pro",
    provider: "google",
    recommended: true,
    maxResolutionLabel: "4K",
    descriptionKey: "nano-banana-pro",
    capabilities: [MODELS["nano-banana-pro"]],
  },
];

export function isImageToImageModel(id: ModelId): boolean {
  return MODELS[id].capability === "image-to-image";
}

export function getModelGroupByModelId(id: ModelId): ModelGroup {
  const group = MODEL_GROUPS.find((item) => item.capabilities.some((model) => model.id === id));
  if (!group) {
    throw new Error(`Model group not found for ${id}`);
  }

  return group;
}

export function getModel(id: ModelId): ModelInfo {
  return MODELS[id];
}
