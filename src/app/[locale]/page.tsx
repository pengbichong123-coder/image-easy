import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/SiteFooter";
import { Link, locales } from "@/i18n/routing";
import { MODEL_GROUPS } from "@/lib/models";
import { setRequestLocale, getMessages } from "next-intl/server";
import { generatePageMetadata } from "@/lib/page-metadata";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://image-easy.app";

type ExampleItem = {
  title: string;
  category: string;
  model: string;
  body: string;
  imageUrl: string;
};

const PROVIDER_NAME = {
  openai: "OpenAI",
  bytedance: "ByteDance",
  google: "Google",
} as const;

const USE_CASE_IMAGE_CARDS = [
  { itemIndex: 1, tone: "bg-[#F7F2EA]" },
  { itemIndex: 4, tone: "bg-[#F4ECF8]" },
  { itemIndex: 6, tone: "bg-[#EEF2F4]" },
] as const;

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
  const exampleItems =
    (((messages as Record<string, unknown>).examples as { items?: ExampleItem[] } | undefined)
      ?.items ?? []);

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
          {t("title")}
        </h1>
        <p className="text-[19px] sm:text-[21px] leading-[1.4] text-[#6E6E73] max-w-[760px] mx-auto">
          {t("lead", { models: t("leadModels"), noNoise: t("leadNoNoise") })}
        </p>
        <div className="mt-8 flex items-center justify-center gap-8">
          <Link href="/create" className="btn btn-primary">
            {t("section3Cta")}
          </Link>
          <Link href="/creations" className="btn btn-link">
            {tNav("archive")} ›
          </Link>
        </div>
      </section>

      <FeaturedExamples
        title={t("examplesTitle")}
        lead={t("examplesLead")}
        linkLabel={t("examplesLink")}
        items={exampleItems.slice(0, 6)}
      />

      {/* ============================================
          FEATURE HERO — soft panel
          ============================================ */}
      <section className="px-3 sm:px-5 pb-20">
        <div className="max-w-[1280px] mx-auto bg-gradient-to-b from-[#F5F5F7] to-white rounded-[24px] px-5 py-20 sm:py-24 text-center">
          <h2 className="display text-[48px] sm:text-[64px] text-[#1D1D1F] mb-4">
            {t("limitedTitle")}
          </h2>
          <div className="text-[19px] text-[#6E6E73] max-w-[580px] mx-auto leading-[1.4]">
            {t("limitedBody")}
          </div>
          <div className="mt-7">
            <Link href="/pricing" className="btn btn-link">
              {t("limitedLink")} ›
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          MODELS — 3-column card grid
          ============================================ */}
      <section className="max-w-[1280px] mx-auto px-3 sm:px-5 pb-20">
        <div className="text-center mb-12">
          <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-3">
            {t("modelCompareTitle")}
          </h2>
          <div className="text-[19px] text-[#6E6E73] max-w-[520px] mx-auto leading-[1.4]">
            {t("modelCompareBody")}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODEL_GROUPS.map((model) => (
            <Link
              key={model.slug}
              href={{ pathname: "/create", query: { model: model.capabilities[0]?.id } }}
              className="group bg-[#F5F5F7] hover:bg-white rounded-[24px] p-8 min-h-[380px] flex flex-col justify-between text-left transition-colors border border-transparent hover:border-[#E5E5E7]"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="flex flex-wrap gap-2">
                    {model.capabilities.map((capability) => (
                      <span
                        key={capability.id}
                        className="rounded-full bg-white px-2.5 py-1 text-[12px] text-[#6E6E73]"
                      >
                        {capability.capability === "text-to-image" ? tModel("t2i") : tModel("i2i")}
                      </span>
                    ))}
                  </div>
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
                  {PROVIDER_NAME[model.provider]} · {model.maxResolutionLabel}
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
            {t("section2Title")}
          </h2>
          <div className="text-[19px] text-[#6E6E73] max-w-[560px] mx-auto leading-[1.4] mb-14">
            {t("section2Body", { em: t("section2BodyEm") })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 bg-white rounded-[24px] overflow-hidden text-left">
            <ProcessStep num="1." title={tNav("expose")} text={t("step1Text")} />
            <ProcessStep num="2." title={t("section2BodyEm")} text={t("step2Text")} />
            <ProcessStep num="3." title={tNav("archive")} text={t("step3Text")} />
          </div>
        </div>
      </section>

      {/* ============================================
          USE CASES
          ============================================ */}
      <section className="max-w-[1180px] mx-auto px-5 py-20">
        <div className="mb-10 max-w-[720px]">
          <div className="text-[14px] text-[#6E6E73] mb-3">
            {t("useCasesKicker")}
          </div>
          <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-3">
            {t("useCasesTitle")}
          </h2>
          <p className="text-[19px] text-[#6E6E73] leading-[1.4]">
            {t("useCasesLead")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <UseCaseImageCard
            title={t("useCase1Title")}
            body={t("useCase1Body")}
            imageUrl={exampleItems[USE_CASE_IMAGE_CARDS[0].itemIndex]?.imageUrl ?? ""}
            tone={USE_CASE_IMAGE_CARDS[0].tone}
          />
          <UseCaseImageCard
            title={t("useCase2Title")}
            body={t("useCase2Body")}
            imageUrl={exampleItems[USE_CASE_IMAGE_CARDS[1].itemIndex]?.imageUrl ?? ""}
            tone={USE_CASE_IMAGE_CARDS[1].tone}
          />
          <UseCaseImageCard
            title={t("useCase3Title")}
            body={t("useCase3Body")}
            imageUrl={exampleItems[USE_CASE_IMAGE_CARDS[2].itemIndex]?.imageUrl ?? ""}
            tone={USE_CASE_IMAGE_CARDS[2].tone}
          />
        </div>
      </section>

      {/* ============================================
          FAQ
          ============================================ */}
      <section className="max-w-[980px] mx-auto px-5 py-20">
        <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-8">
          {t("faqTitle")}
        </h2>
        <div className="divide-y divide-[#D2D2D7]">
          <FaqItem question={t("faq1Q")} answer={t("faq1A")} />
          <FaqItem question={t("faq2Q")} answer={t("faq2A")} />
          <FaqItem question={t("faq3Q")} answer={t("faq3A")} />
        </div>
      </section>

      {/* ============================================
          FINAL CTA
          ============================================ */}
      <section className="max-w-[980px] mx-auto px-5 py-24 text-center">
        <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-4">
          {t("section3Title")}
        </h2>
        <div className="text-[19px] text-[#6E6E73] mb-8">
          {t("section3Body")}
        </div>
        <Link href="/create" className="btn btn-primary">
          {t("section3Cta")}
        </Link>
      </section>

      <SiteFooter variant="full" />
    </div>
  );
}

function FeaturedExamples({
  title,
  lead,
  linkLabel,
  items,
}: {
  title: string;
  lead: string;
  linkLabel: string;
  items: ExampleItem[];
}) {
  return (
    <section className="max-w-[1280px] mx-auto px-3 sm:px-5 pb-20">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
        <div className="px-2 sm:px-0">
          <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-3">
            {title}
          </h2>
          <p className="text-[19px] text-[#6E6E73] max-w-[540px] leading-[1.4]">
            {lead}
          </p>
          <div className="mt-7">
            <Link href="/examples" className="btn btn-link">
              {linkLabel} ›
            </Link>
          </div>
        </div>
        <Link
          href="/examples"
          className="group grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-[24px] bg-[#F5F5F7] p-2"
          aria-label={linkLabel}
        >
          {items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="relative aspect-square overflow-hidden rounded-[18px] bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-12">
                <div className="text-[12px] font-medium text-white">
                  {item.category}
                </div>
              </div>
            </div>
          ))}
        </Link>
      </div>
    </section>
  );
}

function UseCaseImageCard({
  title,
  body,
  imageUrl,
  tone,
}: {
  title: string;
  body: string;
  imageUrl: string;
  tone: string;
}) {
  return (
    <Link
      href="/examples"
      className={`group overflow-hidden rounded-[24px] ${tone} min-h-[360px] flex flex-col`}
    >
      <div className="aspect-[4/3] overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      </div>
      <div className="p-8">
        <h3 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.01em] mb-4 text-[#1D1D1F]">
          {title}
        </h3>
        <p className="text-[15px] leading-[1.5] text-[#6E6E73]">
          {body}
        </p>
      </div>
    </Link>
  );
}

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <div className="py-6 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
      <h3 className="text-[19px] font-semibold text-[#1D1D1F]">
        {question}
      </h3>
      <p className="text-[16px] leading-[1.6] text-[#6E6E73]">
        {answer}
      </p>
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
