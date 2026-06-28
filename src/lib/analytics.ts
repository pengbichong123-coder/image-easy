export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(name: string, params?: AnalyticsParams) {
  if (typeof window === "undefined") return;
  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;
  gtag("event", name, params ?? {});
}
