import { Suspense } from "react";
import { LoginContent } from "./login-content";
import { generatePageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({ locale, page: "login" });
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
