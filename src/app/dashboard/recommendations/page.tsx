import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import RecommendationsView from "@/components/dashboard/RecommendationsView";
import { generateRecommendations } from "@/lib/supplyChain";
import type { Business, InventoryItem, PurchaseOrderWithDetails, Supplier } from "@/types";

export default async function RecommendationsPage() {
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

  const [{ data: items }, { data: suppliers }, { data: orders }] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("business_id", typedBusiness.id),
    supabase.from("suppliers").select("*").eq("business_id", typedBusiness.id),
    supabase.from("purchase_orders").select("*").eq("business_id", typedBusiness.id),
  ]);

  const supplierById = new Map(((suppliers as Supplier[]) ?? []).map((s) => [s.id, s]));
  const ordersWithSupplier: PurchaseOrderWithDetails[] = ((orders ?? []) as PurchaseOrderWithDetails[]).map((o) => ({
    ...o,
    supplier: supplierById.get(o.supplier_id) ?? null,
    items: [],
  }));

  const recommendations = generateRecommendations(
    (items as InventoryItem[]) ?? [],
    (suppliers as Supplier[]) ?? [],
    ordersWithSupplier
  );

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <RecommendationsView recommendations={recommendations} hasData={(items?.length ?? 0) > 0} />
    </main>
  );
}
