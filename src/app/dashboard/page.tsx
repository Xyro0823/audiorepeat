import { registerRoute } from "@/lib/i18n/register/route";
registerRoute("dashboard");
import SetLibrary from "@/components/library/SetLibrary";

export default function DashboardPage() {
  return <SetLibrary />;
}
