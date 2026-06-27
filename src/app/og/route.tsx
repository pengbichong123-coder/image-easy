import { ImageResponse } from "next/og";
import { locales, localeLabels, hasLocale } from "@/i18n/routing";

export const runtime = "edge";

// 9 language OG images, one per locale.
// URL: /og?lang=en|fr|de|es|it|nl|zh|ja|ko
// Default: en.

const SLOGAN: Record<string, { eyebrow: string; title: string; sub: string }> = {
  en: {
    eyebrow: "AI image creation",
    title: "made focused.",
    sub: "Five production-grade AI image models in one workspace.",
  },
  zh: {
    eyebrow: "AI 图像创作",
    title: "更专注。",
    sub: "五款主流 AI 图像模型，一个清爽的工作台。",
  },
  ja: {
    eyebrow: "AI image creation",
    title: "made focused.",
    sub: "Five production-grade AI image models in one workspace.",
  },
  ko: {
    eyebrow: "AI image creation",
    title: "made focused.",
    sub: "Five production-grade AI image models in one workspace.",
  },
  fr: {
    eyebrow: "AI image creation",
    title: "made focused.",
    sub: "Five production-grade AI image models in one workspace.",
  },
  de: {
    eyebrow: "AI image creation",
    title: "made focused.",
    sub: "Five production-grade AI image models in one workspace.",
  },
  es: {
    eyebrow: "AI image creation",
    title: "made focused.",
    sub: "Five production-grade AI image models in one workspace.",
  },
  it: {
    eyebrow: "AI image creation",
    title: "made focused.",
    sub: "Five production-grade AI image models in one workspace.",
  },
  nl: {
    eyebrow: "AI image creation",
    title: "made focused.",
    sub: "Five production-grade AI image models in one workspace.",
  },
};

const CJK_LOCALES = new Set(["zh", "ja", "ko"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const langParam = searchParams.get("lang") ?? "en";
  const lang = hasLocale(langParam) ? langParam : "en";
  const copy = SLOGAN[lang] ?? SLOGAN.en;

  // Fetch a TTF/OTF font that satori can read. Google Fonts CSS points to
  // woff2 which satori doesn't accept, so we hit a raw GitHub source for
  // the TTF instead.
  let fontData: ArrayBuffer | undefined;
  try {
    const fontUrl = CJK_LOCALES.has(lang)
      ? "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSans/full/ttf/NotoSans-Regular.ttf"
      : "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Regular.otf";
    const r = await fetch(fontUrl, { cache: "force-cache" });
    fontData = await r.arrayBuffer();
  } catch {
    fontData = undefined;
  }

  const fontName = CJK_LOCALES.has(lang) ? "NotoSans" : "Inter";
  const fonts:
    | { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]
    | undefined = fontData
    ? [
        { name: fontName, data: fontData, weight: 400, style: "normal" as const },
        { name: fontName, data: fontData, weight: 700, style: "normal" as const },
      ]
    : undefined;

  return renderResponse(lang, copy, fonts);
}

function renderResponse(
  lang: string,
  copy: { eyebrow: string; title: string; sub: string },
  fonts:
    | { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]
    | undefined,
) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1d1d1f 60%, #0a0a0a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Top bar: brand mark + locale tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "32px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: "#0066CC",
                display: "flex",
              }}
            />
            <span>Image Easy</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "20px",
              color: "#86868B",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            <span>{localeLabels[lang as keyof typeof localeLabels]}</span>
          </div>
        </div>

        {/* Centerpiece: title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            marginBottom: "auto",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              color: "#86868B",
              fontWeight: 400,
              letterSpacing: "0.02em",
              marginBottom: "8px",
              display: "flex",
            }}
          >
            {copy.eyebrow}
          </div>
          <div
            style={{
              fontSize: "104px",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "#ffffff",
              display: "flex",
            }}
          >
            {copy.title}
          </div>
        </div>

        {/* Bottom: tagline + URL */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              color: "#86868B",
              maxWidth: "720px",
              lineHeight: 1.3,
              display: "flex",
            }}
          >
            {copy.sub}
          </div>
          <div
            style={{
              fontSize: "22px",
              color: "#0066CC",
              fontWeight: 500,
              letterSpacing: "0.02em",
              display: "flex",
            }}
          >
            image-easy.app
          </div>
        </div>

        {/* Accent strip at the bottom edge */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background:
              "linear-gradient(90deg, #0066CC 0%, #00C2FF 50%, #0066CC 100%)",
            display: "flex",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fonts as never,
    },
  );
}
