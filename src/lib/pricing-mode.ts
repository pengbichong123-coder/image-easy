export function isPaidCreditsEnabled(value?: string | null) {
  return value?.trim().toLowerCase() === "true";
}
