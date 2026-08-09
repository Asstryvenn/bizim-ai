import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardView from "@/components/DashboardView";
import BusinessNotFound from "@/components/BusinessNotFound";
import type { Business, ImportedFile } from "@/types";
import { computeStats } from "@/lib/analytics";
import { getPaymentService } from "@/lib/subscription/paymentService";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!business) {
    return <BusinessNotFound />;
  }

  const typedBusiness = business as Business;

  // Загружаем ВЕСЬ список импортированных файлов для ImportPanel
  // (раньше сюда всегда передавался initialFiles={[]}).
  const { data: importedFiles } = await supabase
    .from("imported_files")
    .select("*")
    .eq("business_id", typedBusiness.id)
    .order("created_at", { ascending: false });

  const files = (importedFiles as ImportedFile[]) ?? [];
  const latestFile = files[0];

  const rows = latestFile?.parsed_data ?? [];
  const analytics = computeStats(rows);

  const subscription = await getPaymentService(supabase).getSubscription(typedBusiness.id);

  return (
    <DashboardView
      business={typedBusiness}
      userEmail={user.email ?? ""}
      files={files}
      analytics={analytics}
      subscription={subscription}
    />
  );
}
