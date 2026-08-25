import { registerRoute } from "@/lib/i18n/register/route";
registerRoute("landing");
import LandingPage from "@/components/landing/LandingPage";
import { faqStructuredData, serializeStructuredData, softwareApplicationStructuredData } from "@/lib/structuredData";

export default function HomePage() {
  const structuredData = [softwareApplicationStructuredData(), faqStructuredData()];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
      />
      <LandingPage />
    </>
  );
}
