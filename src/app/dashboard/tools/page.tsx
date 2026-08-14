import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import ToolsView from "@/components/dashboard/ToolsView";
import type { Business, BusinessTool } from "@/types";

export default async function ToolsPage() {
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

  const { data: businessTools } = await supabase
    .from("business_tools")
    .select("*")
    .eq("business_id", typedBusiness.id);

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <ToolsView business={typedBusiness} initialBusinessTools={(businessTools as BusinessTool[]) ?? []} />
    </main>
  );
}
