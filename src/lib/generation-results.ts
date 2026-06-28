export function parseJsonStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    console.error("Failed to parse generation result metadata");
    return [];
  }
}

export async function resolveGenerationResultUrls(
  generation: {
    resultUrls: string | null;
    resultAssetKeys: string | null;
  },
  signAssetUrl: (key: string) => Promise<string>,
) {
  const assetKeys = parseJsonStringArray(generation.resultAssetKeys);
  if (assetKeys.length > 0) {
    try {
      return await Promise.all(assetKeys.map((key) => signAssetUrl(key)));
    } catch {
      console.error("Failed to resolve generation result asset URLs");
    }
  }

  return parseJsonStringArray(generation.resultUrls);
}
