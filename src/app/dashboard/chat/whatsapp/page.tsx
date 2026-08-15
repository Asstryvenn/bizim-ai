import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import WhatsAppInbox from "@/components/whatsapp/WhatsAppInbox";
import type { Business } from "@/types";

export default async function WhatsAppChatPage() {
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
    <div className="flex h-screen flex-col overflow-hidden bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex gap-2">
          <Link
            href="/dashboard/chat"
            className="rounded-xl px-3 py-1.5 text-sm font-medium text-ink/50 transition hover:bg-mist hover:text-ink"
          >
            AI-чат
          </Link>
          <Link
            href="/dashboard/chat/whatsapp"
            className="rounded-xl bg-card px-3 py-1.5 text-sm font-medium text-ink shadow-sm"
          >
            WhatsApp
          </Link>
        </div>
        <div className="h-[calc(100%-2.75rem)]">
          <WhatsAppInbox />
        </div>
      </div>
    </div>
  );
}
