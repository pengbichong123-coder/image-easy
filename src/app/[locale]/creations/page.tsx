import { CreationsContent } from "./creations-content";
import { generatePageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({ locale, page: "creations" });
}

export default function CreationsPage() {
  return <CreationsContent />;
}
