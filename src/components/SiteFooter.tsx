import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

type SiteFooterProps = {
  variant?: "full" | "compact";
};

export async function SiteFooter({ variant = "full" }: SiteFooterProps) {
  const t = await getTranslations("home");

  if (variant === "compact") {
    return (
      <footer className="border-t border-[#E5E5E7] bg-white py-6">
        <div className="max-w-[980px] mx-auto px-5 flex flex-col sm:flex-row justify-between gap-3 text-[12px] text-[#6E6E73]">
          <div>{t("footerCopyright")}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/privacy" className="hover:text-[#1D1D1F]">
              {t("footerPrivacyPolicy")}
            </Link>
            <Link href="/terms" className="hover:text-[#1D1D1F]">
              {t("footerTerms")}
            </Link>
            <Link href="/legal" className="hover:text-[#1D1D1F]">
              {t("footerLegal")}
            </Link>
            <Link href="/contact" className="hover:text-[#1D1D1F]">
              {t("footerContact")}
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-[#D2D2D7] bg-white py-10">
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
            <Link href="/creations" className="block text-[#6E6E73] hover:text-[#1D1D1F] py-1">
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
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/privacy" className="hover:text-[#1D1D1F]">
              {t("footerPrivacyPolicy")}
            </Link>
            <Link href="/terms" className="hover:text-[#1D1D1F]">
              {t("footerTerms")}
            </Link>
            <Link href="/legal" className="hover:text-[#1D1D1F]">
              {t("footerLegal")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
