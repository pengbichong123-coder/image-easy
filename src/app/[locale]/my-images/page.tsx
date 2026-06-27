import { MyImagesContent } from "./my-images-content";
import { generatePageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({ locale, page: "my-images" });
}

export default function MyImagesPage() {
  return <MyImagesContent />;
}
