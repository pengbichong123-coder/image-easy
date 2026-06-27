import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/i18n/routing";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const config = {
  // Match all pathnames except for
  // - API routes (api/...)
  // - Internal Next.js routes (_next, _vercel)
  // - Static assets: sitemap, robots, favicon, og image
  // - Any file with an extension (e.g. .png, .ico)
  matcher: [
    "/((?!api|_next|og|sitemap|robots|favicon.ico|.*\\..*).*)",
  ],
};
