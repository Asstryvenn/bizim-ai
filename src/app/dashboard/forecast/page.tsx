import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import ForecastView from "@/components/dashboard/ForecastView";
import type { Business, InventoryItem } from "@/types";

export default async function ForecastPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!business) redirect("/register");

  const typedBusiness = business as Business;

  const { data: items } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("business_id", typedBusiness.id)
    .order("avg_daily_usage", { ascending: false });

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <ForecastView items={(items as InventoryItem[]) ?? []} />
    </main>
  );
}
