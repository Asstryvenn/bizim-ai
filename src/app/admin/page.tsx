import { redirect } from "next/navigation";
import {
  requireAdmin,
  adminServiceClient,
  buildDailySeries,
  ForbiddenError,
  NotAuthenticatedError,
} from "@/lib/admin";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminForbidden from "@/components/admin/AdminForbidden";
import AdminHeaderBar from "@/components/admin/AdminHeaderBar";
import type {
  AdminUserRow,
  AdminBusinessRow,
  AdminAnalysisRow,
  AdminGrowthToolRow,
  AdminStats,
  AdminTopBusiness,
  Business,
} from "@/types";
import type { User } from "@supabase/supabase-js";

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      return <AdminForbidden />;
    }
    throw err;
  }

  const supabase = adminServiceClient();

  const [{ data: businessesData }, { data: analysesData }, { data: toolsData }, usersResult] =
    await Promise.all([
      supabase.from("businesses").select("*").order("created_at", { ascending: false }),
      supabase
        .from("ai_analyses")
        .select("*, businesses(business_name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("growth_tools")
        .select("*, businesses(business_name)")
        .order("created_at", { ascending: false }),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  const businesses = (businessesData ?? []) as Business[];
  const authUsers = usersResult.data?.users ?? [];

  const analysesCountByBusiness = new Map<string, number>();
  for (const a of analysesData ?? []) {
    analysesCountByBusiness.set(
      a.business_id,
      (analysesCountByBusiness.get(a.business_id) ?? 0) + 1
    );
  }

  const growthToolsCountByBusiness = new Map<string, number>();
  for (const t of toolsData ?? []) {
    growthToolsCountByBusiness.set(
      t.business_id,
      (growthToolsCountByBusiness.get(t.business_id) ?? 0) + 1
    );
  }

  const lastActivityByBusiness = new Map<string, string>();
  for (const a of analysesData ?? []) {
    const prev = lastActivityByBusiness.get(a.business_id);
    if (!prev || new Date(a.created_at) > new Date(prev)) {
      lastActivityByBusiness.set(a.business_id, a.created_at);
    }
  }
  for (const t of toolsData ?? []) {
    const prev = lastActivityByBusiness.get(t.business_id);
    if (!prev || new Date(t.created_at) > new Date(prev)) {
      lastActivityByBusiness.set(t.business_id, t.created_at);
    }
  }

  const businessByUserId = new Map(businesses.map((b) => [b.user_id, b]));
  const emailByUserId = new Map<string, string | null>(
    authUsers.map((u: User) => [u.id, u.email ?? null])
  );

  const users: AdminUserRow[] = authUsers.map((u: User) => {
    const business = businessByUserId.get(u.id);
    return {
      user_id: u.id,
      business_id: business?.id ?? null,
      email: u.email ?? "—",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      business_name: business?.business_name ?? null,
      city: business?.city ?? null,
      role: (business?.role as "admin" | "user") ?? "user",
      analyses_count: business ? analysesCountByBusiness.get(business.id) ?? 0 : 0,
    };
  });

  const businessRows: AdminBusinessRow[] = businesses.map((b) => ({
    ...b,
    email: emailByUserId.get(b.user_id) ?? null,
    analyses_count: analysesCountByBusiness.get(b.id) ?? 0,
    growth_tools_count: growthToolsCountByBusiness.get(b.id) ?? 0,
  }));

  const topBusinesses: AdminTopBusiness[] = [...businessRows]
    .sort((a, b) => b.analyses_count - a.analyses_count)
    .slice(0, 8)
    .map((b) => ({
      id: b.id,
      business_name: b.business_name,
      analyses_count: b.analyses_count,
      growth_tools_count: b.growth_tools_count,
      last_activity: lastActivityByBusiness.get(b.id) ?? b.updated_at ?? null,
    }));

  const analysisRows: AdminAnalysisRow[] = (analysesData ?? []).map((a: any) => ({
    id: a.id,
    business_id: a.business_id,
    source_file_id: a.source_file_id,
    report: a.report,
    raw_stats: a.raw_stats,
    created_at: a.created_at,
    business_name: a.businesses?.business_name ?? null,
  }));

  const toolRows: AdminGrowthToolRow[] = (toolsData ?? []).map((t: any) => ({
    id: t.id,
    business_id: t.business_id,
    analysis_id: t.analysis_id,
    tool_type: t.tool_type,
    title: t.title,
    content: t.content,
    created_at: t.created_at,
    business_name: t.businesses?.business_name ?? null,
  }));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stats: AdminStats = {
    usersCount: users.length,
    businessesCount: businesses.length,
    analysesCount: analysesData?.length ?? 0,
    growthToolsCount: toolsData?.length ?? 0,
    registeredToday: businesses.filter((b) => new Date(b.created_at) >= todayStart).length,
    activeUsers7d: users.filter(
      (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= sevenDaysAgo
    ).length,
  };

  // Временные ряды за 90 дней — переключатель 7/30/90 нарезает их на клиенте.
  const registrationsSeries = buildDailySeries(
    businesses.map((b) => b.created_at),
    90
  );
  const analysesSeries = buildDailySeries(
    (analysesData ?? []).map((a: { created_at: string }) => a.created_at),
    90
  );

  const [
    { count: ordersCount },
    { count: inventoryCount },
    { count: lowStockCount },
    { count: suppliersCount },
    { count: activeSubscriptionsCount },
    { count: whatsappConversationsCount },
    { count: whatsappMessagesCount },
    { data: recentConversations },
  ] = await Promise.all([
    supabase.from("purchase_orders").select("*", { count: "exact", head: true }),
    supabase.from("inventory_items").select("*", { count: "exact", head: true }),
    supabase.from("inventory_items").select("*", { count: "exact", head: true }).lt("current_stock", 5),
    supabase.from("suppliers").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("whatsapp_conversations").select("*", { count: "exact", head: true }),
    supabase.from("whatsapp_messages").select("*", { count: "exact", head: true }),
    supabase
      .from("whatsapp_conversations")
      .select("contact_name, customer_phone, last_message_preview, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const systemData = {
    ordersCount: ordersCount ?? 0,
    inventoryCount: inventoryCount ?? 0,
    lowStockCount: lowStockCount ?? 0,
    suppliersCount: suppliersCount ?? 0,
    activeSubscriptionsCount: activeSubscriptionsCount ?? 0,
    whatsappConversationsCount: whatsappConversationsCount ?? 0,
    whatsappMessagesCount: whatsappMessagesCount ?? 0,
    whatsappRecentConversations: (recentConversations ?? []).map((c: any) => ({
      contact: c.contact_name || c.customer_phone,
      preview: c.last_message_preview,
      updatedAt: c.updated_at,
    })),
    whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    whatsappPhoneNumberIdSet: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    whatsappBusinessAccountIdSet: Boolean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseOk: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  };

  return (
    <main className="min-h-screen bg-mist">
      <AdminHeaderBar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <AdminTabs
          stats={stats}
          users={users}
          businesses={businessRows}
          analyses={analysisRows}
          growthTools={toolRows}
          topBusinesses={topBusinesses}
          registrationsSeries={registrationsSeries}
          analysesSeries={analysesSeries}
          systemData={systemData}
        />
      </div>
    </main>
  );
}
