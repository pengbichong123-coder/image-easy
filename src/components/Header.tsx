"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, Link } from "@/i18n/routing";
import { useSession, signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { locales, localeLabels, type Locale } from "@/i18n/routing";

export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const tLanguage = useTranslations("language");
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [, startTransition] = useTransition();

  function switchLocale(next: Locale) {
    setLangOpen(false);
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#D2D2D7]/40">
      <div className="max-w-[980px] mx-auto px-5 h-12 flex items-center justify-between text-[12px]">
        {/* Logo */}
        <Link href="/" className="font-medium text-[#1D1D1F] tracking-tight">
          Image Easy
        </Link>

        {/* Center nav — Apple product style */}
        <nav className="hidden md:flex items-center">
          <NavItem href="/" label={tNav("atelier")} pathname={pathname} />
          <NavItem href="/pricing" label={tNav("pricing")} pathname={pathname} />
          <NavItem href="/create" label={tNav("expose")} pathname={pathname} />
          <NavItem href="/my-images" label={tNav("archive")} pathname={pathname} />
        </nav>

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Language switcher */}
          <div className="relative">
            <button
              type="button"
              aria-label={tLanguage("switchTitle")}
              onClick={() => setLangOpen((v) => !v)}
              className="text-[#1D1D1F] opacity-60 hover:opacity-100 transition-opacity text-[11px] tracking-[0.05em] uppercase"
            >
              {locale}
            </button>
            {langOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-40 bg-white rounded-2xl shadow-xl border border-[#E5E5E7] overflow-hidden z-50"
                onMouseLeave={() => setLangOpen(false)}
              >
                <div className="p-1">
                  {locales.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => switchLocale(l)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-[12px] rounded-md transition-colors",
                        l === locale
                          ? "bg-[#F5F5F7] text-[#1D1D1F] font-medium"
                          : "text-[#1D1D1F] hover:bg-[#F5F5F7]",
                      )}
                    >
                      {localeLabels[l]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {status === "loading" ? (
            <span className="spinner text-[#86868B]" />
          ) : session?.user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              >
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 bg-[#F5F5F7] rounded-full flex items-center justify-center text-[12px] font-medium text-[#1D1D1F]">
                    {(session.user.name || "U")[0]}
                  </div>
                )}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E5E5E7] overflow-hidden"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-4 py-3 border-b border-[#E5E5E7]">
                    <div className="text-[13px] font-medium mb-0.5 text-[#1D1D1F]">
                      {session.user.name}
                    </div>
                    <div className="text-[11px] text-[#6E6E73] truncate">
                      {session.user.email}
                    </div>
                    <div className="text-[11px] text-[#1D1D1F] mt-2 tabular">
                      {session.user.credits ?? 0} credits
                    </div>
                  </div>
                  <div className="p-1">
                    <Link
                      href="/pricing"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-md"
                    >
                      {tNav("pricing")}
                    </Link>
                    <Link
                      href="/create"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-md"
                    >
                      {tNav("expose")}
                    </Link>
                    <Link
                      href="/my-images"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-md"
                    >
                      {tNav("archive")}
                    </Link>
                  </div>
                  <div className="border-t border-[#E5E5E7] p-1">
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left px-3 py-2 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-md"
                    >
                      {tHeader("signOut")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="text-[#1D1D1F] hover:opacity-70 transition-opacity"
            >
              {tHeader("signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({
  href,
  label,
  pathname,
}: {
  href: "/" | "/create" | "/pricing" | "/my-images";
  label: string;
  pathname: string;
}) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1 transition-opacity",
        active ? "text-[#1D1D1F]" : "text-[#1D1D1F] opacity-60 hover:opacity-100",
      )}
    >
      {label}
    </Link>
  );
}
