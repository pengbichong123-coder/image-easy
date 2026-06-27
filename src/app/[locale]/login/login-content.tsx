"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";

export function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/create";
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("google", { callbackUrl, redirect: false });
      if (res?.error) setError("Sign-in failed: " + res.error);
      else if (res?.ok) router.push(callbackUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-[980px] grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left — copy */}
        <div>
          <div className="text-[14px] text-[#6E6E73] mb-4">
            {t("membersOnlyKicker")}
          </div>
          <h1 className="display text-[56px] sm:text-[64px] text-[#1D1D1F] mb-5 leading-[1.05]">
            {t("loginTitleA")}
            <br />
            <span className="display-em text-[#0066CC]">{t("loginTitleEm")}</span>
            {t("loginTitleB")}
          </h1>
          <p className="text-[19px] text-[#6E6E73] leading-[1.4] max-w-md">
            {t("loginLead")}
          </p>
        </div>

        {/* Right — sign-in panel */}
        <div className="bg-[#F5F5F7] rounded-[24px] p-8 sm:p-10">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-[#E5E5E7] hover:border-[#1D1D1F] rounded-full py-4 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="spinner text-[#1D1D1F]" />
                <span className="text-[16px] text-[#1D1D1F]">{t("googleAuthenticating")}</span>
              </>
            ) : (
              <>
                <GoogleMark />
                <span className="text-[16px] text-[#1D1D1F]">{t("googleContinue")}</span>
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 text-[13px] text-[#D70015] text-center">
              {error}
            </p>
          )}

          <div className="mt-6 pt-6 border-t border-[#E5E5E7] text-[12px] text-[#6E6E73] text-center leading-[1.5]">
            By continuing you accept our
            <br />
            <a className="text-[#0066CC] hover:underline">{t("googleTos")}</a> &amp;{" "}
            <a className="text-[#0066CC] hover:underline">{t("googlePrivacy")}</a>.
          </div>

          <div className="mt-6 text-[12px] text-[#86868B] text-center tabular">
            Secured by Google OAuth 2.0
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
