import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import SettingsForm from "@/components/SettingsForm";
import SettingsHeader from "@/components/SettingsHeader";
import PreferencesSettings from "@/components/PreferencesSettings";
import type { Business } from "@/types";

export default async function SettingsPage() {
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

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        <SettingsHeader />

        <SettingsForm business={typedBusiness} email={user.email ?? ""} />

        <PreferencesSettings />
      </div>
    </main>
  );
}
