import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import SuppliersView from "@/components/dashboard/SuppliersView";
import type { Business, Supplier } from "@/types";

export default async function SuppliersPage() {
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

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("business_id", typedBusiness.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <SuppliersView business={typedBusiness} initialSuppliers={(suppliers as Supplier[]) ?? []} />
    </main>
  );
}
