import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import PricingPlans from "@/components/subscription/PricingPlans";
import { getPaymentService } from "@/lib/subscription/paymentService";
import type { Business } from "@/types";

export default async function PricingPage() {
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
    redirect("/register");
  }

  const typedBusiness = business as Business;
  const subscription = await getPaymentService(supabase).getSubscription(typedBusiness.id);

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <PricingPlans currentPlan={subscription?.status === "active" ? subscription.plan : null} />
      </div>
    </main>
  );
}
