import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/dashboard/Sidebar";
import type { Business } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: business } = await supabase
      .from("businesses")
      .select("role")
      .eq("user_id", user.id)
      .single();
    isAdmin = (business as Pick<Business, "role"> | null)?.role === "admin";
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:flex-row">
      <Sidebar isAdmin={isAdmin} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
