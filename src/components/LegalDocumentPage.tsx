import { getTranslations } from "next-intl/server";

type LegalDocumentPageProps = {
  namespace: "trust.privacy" | "trust.terms" | "trust.legal";
  sections: readonly string[];
};

export async function LegalDocumentPage({
  namespace,
  sections,
}: LegalDocumentPageProps) {
  const t = await getTranslations(namespace);

  return (
    <div className="bg-white">
      <section className="max-w-[860px] mx-auto px-5 py-20 sm:py-28">
        <div className="text-[14px] text-[#6E6E73] mb-3">{t("kicker")}</div>
        <h1 className="display text-[48px] sm:text-[64px] text-[#1D1D1F] mb-5">
          {t("title")}
        </h1>
        <p className="text-[19px] sm:text-[21px] leading-[1.4] text-[#6E6E73] max-w-[720px]">
          {t("lead")}
        </p>
        <p className="mt-6 text-[14px] leading-[1.6] text-[#6E6E73]">
          {t("notice")}
        </p>

        <div className="mt-14 border-t border-[#D2D2D7] divide-y divide-[#E5E5E7]">
          {sections.map((section) => (
            <section key={section} className="py-9">
              <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">
                {t(`${section}Title`)}
              </h2>
              <p className="text-[16px] leading-[1.7] text-[#424245]">
                {t(`${section}Body`)}
              </p>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
