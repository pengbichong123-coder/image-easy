import type { Metadata } from "next";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { SiteFooter } from "@/components/SiteFooter";
import { Link } from "@/i18n/routing";

type PageProps = {
  params: Promise<{ locale: string }>;
};

type ExampleItem = {
  title: string;
  category: string;
  model: string;
  body: string;
  imageUrl: string;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "examples" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ExamplesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("examples");
  const messages = await getMessages();
  const items =
    (((messages as Record<string, unknown>).examples as { items?: ExampleItem[] } | undefined)
      ?.items ?? []);

  return (
    <div className="bg-white">
      <main>
        <section className="max-w-[980px] mx-auto px-5 pt-24 pb-16 text-center">
          <div className="text-[14px] text-[#6E6E73] mb-3">
            {t("kicker")}
          </div>
          <h1 className="display text-[56px] sm:text-[72px] lg:text-[88px] text-[#1D1D1F] mb-6">
            {t("title")}
          </h1>
          <p className="text-[19px] sm:text-[21px] leading-[1.4] text-[#6E6E73] max-w-[760px] mx-auto">
            {t("lead")}
          </p>
        </section>

        <section className="max-w-[1280px] mx-auto px-3 sm:px-5 pb-20">
          <div className="mb-8 px-2 sm:px-0">
            <h2 className="display text-[36px] sm:text-[48px] text-[#1D1D1F]">
              {t("galleryTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item, index) => (
              <article
                key={`${item.title}-${index}`}
                className="overflow-hidden rounded-[24px] bg-[#F5F5F7]"
              >
                <div className="aspect-square overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-7">
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-[#6E6E73]">
                    <span className="rounded-full bg-white px-2.5 py-1">
                      {item.category}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1">
                      {item.model}
                    </span>
                  </div>
                  <h3 className="mb-3 text-[22px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                    {item.title}
                  </h3>
                  <p className="text-[15px] leading-[1.55] text-[#6E6E73]">
                    {item.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="max-w-[980px] mx-auto px-5 py-20 text-center">
          <h2 className="display text-[40px] sm:text-[56px] text-[#1D1D1F] mb-4">
            {t("ctaTitle")}
          </h2>
          <p className="text-[19px] text-[#6E6E73] mb-8">
            {t("ctaBody")}
          </p>
          <Link href="/create" className="btn btn-primary">
            {t("ctaButton")}
          </Link>
        </section>
      </main>
      <SiteFooter variant="full" />
    </div>
  );
}
