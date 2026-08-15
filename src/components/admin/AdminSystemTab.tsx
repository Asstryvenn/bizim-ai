"use client";

export interface AdminSystemData {
  ordersCount: number;
  inventoryCount: number;
  lowStockCount: number;
  suppliersCount: number;
  activeSubscriptionsCount: number;
  whatsappConversationsCount: number;
  whatsappMessagesCount: number;
  whatsappRecentConversations: { contact: string; preview: string | null; updatedAt: string | null }[];
  whatsappConfigured: boolean;
  whatsappPhoneNumberIdSet: boolean;
  whatsappBusinessAccountIdSet: boolean;
  aiConfigured: boolean;
  supabaseOk: boolean;
  environment: string;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-danger"}`} />
  );
}

export default function AdminSystemTab({ data }: { data: AdminSystemData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { icon: "📦", label: "Заказов всего", value: data.ordersCount },
          { icon: "📊", label: "Позиций в остатках", value: data.inventoryCount },
          { icon: "⚠️", label: "Низкий остаток", value: data.lowStockCount },
          { icon: "🚚", label: "Поставщиков", value: data.suppliersCount },
          { icon: "💳", label: "Активных подписок", value: data.activeSubscriptionsCount },
          { icon: "💬", label: "WhatsApp диалогов", value: data.whatsappConversationsCount },
        ].map((c) => (
          <div key={c.label} className="card">
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-2 text-2xl font-semibold">{c.value}</div>
            <div className="text-sm text-ink/50">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">WhatsApp Integration</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <StatusDot ok={data.whatsappConfigured} />
            <span>Access token / provider {data.whatsappConfigured ? "настроен" : "не настроен"}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={data.whatsappPhoneNumberIdSet} />
            <span>Phone Number ID {data.whatsappPhoneNumberIdSet ? "задан" : "не задан"}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={data.whatsappBusinessAccountIdSet} />
            <span>WABA ID {data.whatsappBusinessAccountIdSet ? "задан" : "не задан"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink/50">Сообщений в базе: {data.whatsappMessagesCount}</span>
          </div>
        </div>

        {data.whatsappRecentConversations.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-ink/40 mb-2">Последние диалоги</p>
            <div className="space-y-1.5">
              {data.whatsappRecentConversations.map((c, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-border py-1.5 last:border-0">
                  <span className="font-medium">{c.contact}</span>
                  <span className="text-ink/40 truncate max-w-[50%]">{c.preview ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">System Health</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <StatusDot ok={data.supabaseOk} />
            <span>Supabase connection</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={data.aiConfigured} />
            <span>AI (OpenAI) configuration</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={true} />
            <span>Environment: {data.environment}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
