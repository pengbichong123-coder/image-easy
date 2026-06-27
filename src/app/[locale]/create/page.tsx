import { Suspense } from "react";
import { CreateContent } from "./create-content";
import { generatePageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({ locale, page: "create" });
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      }
    >
      <CreateContent />
    </Suspense>
  );
}
