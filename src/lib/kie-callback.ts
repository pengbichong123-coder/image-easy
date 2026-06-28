const LOCAL_CALLBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function shouldUseKieCallback(
  appUrl = process.env.NEXT_PUBLIC_APP_URL,
  secret = process.env.KIE_CALLBACK_SECRET,
) {
  if (!appUrl || !secret) {
    return false;
  }

  try {
    const url = new URL(appUrl);
    return url.protocol === "https:" && !LOCAL_CALLBACK_HOSTNAMES.has(url.hostname);
  } catch {
    return false;
  }
}

export function buildKieCallbackUrl(
  generationId: string,
  appUrl = process.env.NEXT_PUBLIC_APP_URL,
  secret = process.env.KIE_CALLBACK_SECRET,
) {
  if (!shouldUseKieCallback(appUrl, secret) || !appUrl || !secret) {
    return undefined;
  }

  const callbackUrl = new URL("/api/kie/callback", appUrl.replace(/\/$/, ""));
  callbackUrl.searchParams.set("generationId", generationId);
  callbackUrl.searchParams.set("token", secret);

  return callbackUrl.toString();
}
