import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import InventoryView from "@/components/dashboard/InventoryView";
import type { Business, InventoryItem, Supplier } from "@/types";

export default async function InventoryPage() {
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

  const [{ data: items }, { data: suppliers }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*")
      .eq("business_id", typedBusiness.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("suppliers")
      .select("*")
      .eq("business_id", typedBusiness.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <InventoryView
        business={typedBusiness}
        initialItems={(items as InventoryItem[]) ?? []}
        suppliers={(suppliers as Supplier[]) ?? []}
      />
    </main>
  );
}
