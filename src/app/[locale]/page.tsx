import { getTranslations } from "next-intl/server";
import { Link, locales } from "@/i18n/routing";
import { ALL_MODELS } from "@/lib/models";
import { setRequestLocale, getMessages } from "next-intl/server";
import { generatePageMetadata } from "@/lib/page-metadata";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://image-easy.app";

const PROVIDER_NAME = {
  openai: "OpenAI",
  bytedance: "ByteDance",
  google: "Google",
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({ locale, page: "home" });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tModel = await getTranslations("model");
  const tNav = await getTranslations("nav");
  const messages = await getMessages();
  const modelDescriptions = ((messages as Record<string, unknown>).model as {
    descriptions: Record<string, string>;
  }).descriptions;

  return (
    <div className="bg-white">
      {/* JSON-LD structured data for the application */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Image Easy",
            applicationCategory: "MultimediaApplication",
            applicationSubCategory: "AI Image Generation",
            operatingSystem: "Web",
            description: t("lead", { models: t("leadModels"), noNoise: t("leadNoNoise") }),
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              description: "Free tier with 10 image generations on sign-up",
            },
            inLanguage: [...locales],
            url: `${SITE_URL}/${locale}`,
          }),
        }}
      />
      {/* ============================================
          HERO
          ============================================ */}
      <section className="max-w-[980px] mx-auto px-5 pt-24 pb-20 text-center">
        <div className="text-[14px] text-[#6E6E73] mb-3">
          {t("kicker")}
        </div>
        <h1 className="display text-[64px] sm:text-[80px] lg:text-[96px] text-[#1D1D1F] mb-6">
          {t("titleA")}
          <br />
          <span className="display-em">{t("titleEm")}</span> {t("titleB")}
        </h1>
        <p className="text-[19px] sm:text-[21px] leading-[1.4] text-[#6E6E73] max-w-[760px] mx-auto">
          {t("lead", { models: t("leadModels"), noNoise: t("leadNoNoise") })}
        </p>
        <div className="mt-8 flex items-center justify-center gap-8">
          <Link href="/create" className="btn btn-primary">
            {t("section3Cta")}
          </Link>
          <Link href="/my-images" className="btn btn-link">
            {tNav("archive")} ›
          </Link>
        </div>
      </section>

      {/* ============================================
          FEATURE HERO — soft panel
          ============================================ */}
      <section className="px-3 sm:px-5 pb-20">
        <div className="max-w-[1280px] mx-auto bg-gradient-to-b from-[#F5F5F7] to-white rounded-[24px] px-5 py-20 sm:py-24 text-center">
          <h2 className="display text-[48px] sm:text-[64px] text-[#1D1D1F] mb-4">
            {t("section1TitleA")} <span className="display-em text-[#0066CC]">{t("section1TitleEm")}</span>
            {t("section1TitleB")}
          </h2>
          <div className="text-[19px] text-[#6E6E73] max-w-[580px] mx-auto leading-[1.4]">
            {t("section1Body", { em: t("section1BodyEm") })}
          </div>
        </div>
      </section>

      {/* ============================================
          MODELS — 3-column card grid
          ============================================ */}
      <section className="max-w-[1280px] mx-auto px-3 sm:px-5 pb-20">
        <div className="text-center mb-12">
          <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-3">
            {t("section1TitleA")} <span className="display-em text-[#0066CC]">{t("section1BodyEm")}</span>
            {t("section1TitleB")}
          </h2>
          <div className="text-[19px] text-[#6E6E73] max-w-[520px] mx-auto leading-[1.4]">
            {t("section1Body", { em: t("section1BodyEm") })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_MODELS.map((model) => (
            <Link
              key={model.id}
              href={{ pathname: "/create", query: { model: model.id } }}
              className="group bg-[#F5F5F7] hover:bg-white rounded-[24px] p-8 min-h-[380px] flex flex-col justify-between text-left transition-colors border border-transparent hover:border-[#E5E5E7]"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <span className="text-[13px] text-[#6E6E73] tabular">
                    {model.capability === "text-to-image" ? tModel("t2i") : tModel("i2i")}
                  </span>
                  {model.recommended && (
                    <span className="text-[11px] bg-[#1D1D1F] text-white px-2.5 py-1 rounded-full">
                      {tModel("featured")}
                    </span>
                  )}
                </div>
                <h3 className="display text-[28px] sm:text-[32px] text-[#1D1D1F] mb-2 leading-[1.1]">
                  {model.displayName}
                </h3>
                <div className="text-[14px] text-[#6E6E73]">
                  {PROVIDER_NAME[model.provider]} · 4K
                </div>
              </div>
              <div>
                <p className="text-[15px] leading-[1.5] text-[#1D1D1F] mb-6">
                  {modelDescriptions[model.descriptionKey]}
                </p>
                <span className="text-[15px] text-[#0066CC] font-normal">
                  ›
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============================================
          STEPS — full-bleed soft panel
          ============================================ */}
      <section className="bg-[#F5F5F7] py-20 sm:py-28">
        <div className="max-w-[1080px] mx-auto px-5 text-center">
          <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-3">
            {t("section2TitleA")} <span className="display-em text-[#0066CC]">{t("section2TitleEm")}</span>
          </h2>
          <div className="text-[19px] text-[#6E6E73] max-w-[560px] mx-auto leading-[1.4] mb-14">
            {t("section2Body", { em: t("section2BodyEm") })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 bg-white rounded-[24px] overflow-hidden text-left">
            <ProcessStep num="1." title={tNav("expose")} text={t("section1Body", { em: t("section1BodyEm") })} />
            <ProcessStep num="2." title={t("section2BodyEm")} text={t("section2Body", { em: t("section2BodyEm") })} />
            <ProcessStep num="3." title={tNav("archive")} text={t("section2Body", { em: t("section2BodyEm") })} />
          </div>
        </div>
      </section>

      {/* ============================================
          FINAL CTA
          ============================================ */}
      <section className="max-w-[980px] mx-auto px-5 py-24 text-center">
        <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-4">
          {t("section3TitleA")} <span className="display-em text-[#0066CC]">{t("section3TitleEm")}</span>
          {t("section3TitleB")}
        </h2>
        <div className="text-[19px] text-[#6E6E73] mb-8">
          {t("section3Body")}
        </div>
        <Link href="/create" className="btn btn-primary">
          {t("section3Cta")}
        </Link>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="border-t border-[#D2D2D7] py-10">
        <div className="max-w-[1280px] mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-[12px]">
            <div>
              <h4 className="text-[#1D1D1F] font-medium mb-3">{t("footerAtelier")}</h4>
              <Link href="/" className="block text-[#6E6E73] hover:text-[#1D1D1F] py-1">
                {t("footerCompose")}
              </Link>
              <Link href="/create" className="block text-[#6E6E73] hover:text-[#1D1D1F] py-1">
                {t("footerExpose")}
              </Link>
              <Link href="/my-images" className="block text-[#6E6E73] hover:text-[#1D1D1F] py-1">
                {t("footerArchive")}
              </Link>
            </div>
            <div>
              <h4 className="text-[#1D1D1F] font-medium mb-3">{t("footerModels")}</h4>
              <span className="block text-[#6E6E73] py-1">GPT Image 2</span>
              <span className="block text-[#6E6E73] py-1">Seedream 4.5</span>
              <span className="block text-[#6E6E73] py-1">Nano Banana Pro</span>
            </div>
            <div>
              <h4 className="text-[#1D1D1F] font-medium mb-3">{t("footerResources")}</h4>
              <span className="block text-[#6E6E73] py-1">{t("footerJournal")}</span>
              <span className="block text-[#6E6E73] py-1">{t("footerChangelog")}</span>
              <span className="block text-[#6E6E73] py-1">{t("footerStatus")}</span>
            </div>
            <div>
              <h4 className="text-[#1D1D1F] font-medium mb-3">{t("footerCompany")}</h4>
              <Link href="/about" className="block text-[#6E6E73] hover:text-[#1D1D1F] py-1">
                {t("footerAbout")}
              </Link>
              <Link href="/pricing" className="block text-[#6E6E73] hover:text-[#1D1D1F] py-1">
                {t("footerPricing")}
              </Link>
              <Link href="/contact" className="block text-[#6E6E73] hover:text-[#1D1D1F] py-1">
                {t("footerContact")}
              </Link>
              <Link href="/privacy" className="block text-[#6E6E73] hover:text-[#1D1D1F] py-1">
                {t("footerPrivacy")}
              </Link>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t border-[#D2D2D7] text-[12px] text-[#6E6E73]">
            <div>{t("footerCopyright")}</div>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-[#1D1D1F]">
                {t("footerPrivacyPolicy")}
              </Link>
              <Link href="/terms" className="hover:text-[#1D1D1F]">
                {t("footerTerms")}
              </Link>
              <Link href="/terms" className="hover:text-[#1D1D1F]">
                {t("footerLegal")}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProcessStep({
  num,
  title,
  text,
}: {
  num: string;
  title: string;
  text: string;
}) {
  return (
    <div className="p-10 sm:p-12 border-l border-[#E5E5E7] first:border-l-0 text-left">
      <div className="text-[56px] sm:text-[64px] font-light text-[#0066CC] tracking-[-0.04em] leading-[1] mb-5">
        {num}
      </div>
      <h3 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.01em] mb-2 text-[#1D1D1F]">
        {title}
      </h3>
      <p className="text-[15px] leading-[1.5] text-[#6E6E73]">
        {text}
      </p>
    </div>
  );
}
