import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import type { Business } from "@/types";

interface HistoryEvent {
  type: string;
  icon: string;
  description: string;
  object: string | null;
  status: string | null;
  createdAt: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("*").eq("user_id", user.id).single();
  if (!business) redirect("/register");
  const typedBusiness = business as Business;
  const businessId = typedBusiness.id;

  const [
    { data: activityLog },
    { data: orders },
    { data: analyses },
    { data: whatsappMessages },
  ] = await Promise.all([
    supabase.from("activity_log").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50),
    supabase.from("purchase_orders").select("*, suppliers(name)").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50),
    supabase.from("ai_analyses").select("id, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20),
    supabase
      .from("whatsapp_messages")
      .select("id, direction, status, created_at, whatsapp_conversations(contact_name, customer_phone)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const events: HistoryEvent[] = [];

  for (const a of activityLog ?? []) {
    events.push({
      type: "activity",
      icon: "📝",
      description: a.description ?? a.action,
      object: a.entity_type ?? null,
      status: null,
      createdAt: a.created_at,
    });
  }

  for (const o of (orders as any[]) ?? []) {
    events.push({
      type: "order",
      icon: "🧾",
      description: `Заказ поставщику «${o.suppliers?.name ?? "—"}»`,
      object: o.total_amount !== null ? `${Math.round(o.total_amount).toLocaleString("ru-RU")} ₸` : null,
      status: o.status,
      createdAt: o.created_at,
    });
  }

  for (const a of analyses ?? []) {
    events.push({
      type: "ai_analysis",
      icon: "🤖",
      description: "AI-анализ бизнеса выполнен",
      object: null,
      status: null,
      createdAt: a.created_at,
    });
  }

  for (const m of (whatsappMessages as any[]) ?? []) {
    const contact = m.whatsapp_conversations?.contact_name || m.whatsapp_conversations?.customer_phone || "—";
    events.push({
      type: "whatsapp",
      icon: "💬",
      description: m.direction === "inbound" ? `Входящее сообщение от ${contact}` : `Исходящее сообщение к ${contact}`,
      object: null,
      status: m.status,
      createdAt: m.created_at,
    });
  }

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const topEvents = events.slice(0, 80);

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">История действий</h1>
          <p className="text-sm text-ink/50 mt-1">Реальные события: заказы, AI-анализы, WhatsApp, изменения бизнеса.</p>
        </div>

        {topEvents.length === 0 ? (
          <div className="card text-sm text-ink/50">Пока нет событий — история появится по мере работы с Bizim.</div>
        ) : (
          <div className="card p-0 divide-y divide-border">
            {topEvents.map((e, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="text-lg leading-none">{e.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">{e.description}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink/40">
                    <span>{fmtDate(e.createdAt)}</span>
                    {e.object && <span>· {e.object}</span>}
                    {e.status && <span>· {e.status}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
