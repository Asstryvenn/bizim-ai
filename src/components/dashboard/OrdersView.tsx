"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { advanceOrderStatus, nextOrderStatus } from "@/lib/supplyChainActions";
import { OrderStatusBadge, ORDER_STATUS_LABEL } from "@/components/dashboard/StatusBadge";
import type { Business, OrderStatus, PurchaseOrderWithDetails } from "@/types";

interface OrdersViewProps {
  business: Business;
  initialOrders: PurchaseOrderWithDetails[];
}

const STATUS_TIMELINE: OrderStatus[] = ["draft", "sent", "confirmed", "in_transit", "delivered"];

const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  draft: "Отправить",
  sent: "Подтвердить",
  confirmed: "Отметить «В пути»",
  in_transit: "Отметить «Доставлен»",
};

export default function OrdersView({ business, initialOrders }: OrdersViewProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleAdvance = async (order: PurchaseOrderWithDetails) => {
    const next = nextOrderStatus(order.status);
    if (!next) return;
    setUpdatingId(order.id);
    try {
      const supabase = createClient();
      await advanceOrderStatus(supabase, order.id, business.id, order.supplier?.name ?? "поставщик", next);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
      toast.success(`Статус заказа обновлён: ${ORDER_STATUS_LABEL[next]}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">🧾 Заказы</h1>
        <p className="mt-1 text-ink/60 text-sm">{orders.length} заказов</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-card h-56 flex flex-col items-center justify-center text-ink/40 gap-2">
          <div className="text-5xl">🧾</div>
          <p>Пока нет заказов — сформируйте автозаказ на странице «Остатки»</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id;
            const next = nextOrderStatus(order.status);
            return (
              <div key={order.id} className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div>
                    <p className="font-semibold">
                      Заказ #{order.id.slice(0, 8)} · {order.supplier?.name ?? "Поставщик"}
                    </p>
                    <p className="text-sm text-ink/50 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString("ru-RU")} · {order.items.length} позиций ·{" "}
                      ₸ {order.total_amount.toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    {order.expected_delivery && (
                      <span className="text-xs text-ink/40">Ожидается: {order.expected_delivery}</span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 space-y-4">
                    <div className="flex items-center gap-1">
                      {STATUS_TIMELINE.map((step, i) => {
                        const currentIdx = STATUS_TIMELINE.indexOf(order.status);
                        const reached = order.status !== "delayed" && i <= currentIdx;
                        return (
                          <div key={step} className="flex items-center gap-1 flex-1">
                            <div
                              className={`h-2 flex-1 rounded-full ${reached ? "bg-accent" : "bg-mist"}`}
                              title={ORDER_STATUS_LABEL[step]}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-ink/50">
                      {STATUS_TIMELINE.map((step) => (
                        <span key={step}>{ORDER_STATUS_LABEL[step]}</span>
                      ))}
                    </div>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-ink/50 border-b border-border">
                          <th className="py-2 font-medium">Товар</th>
                          <th className="py-2 font-medium">Кол-во</th>
                          <th className="py-2 font-medium">Цена</th>
                          <th className="py-2 font-medium">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((oi) => (
                          <tr key={oi.id} className="border-b border-border last:border-0">
                            <td className="py-2">{oi.item?.name ?? "—"}</td>
                            <td className="py-2">
                              {oi.quantity} {oi.item?.unit ?? ""}
                            </td>
                            <td className="py-2">₸ {oi.unit_price.toLocaleString("ru-RU")}</td>
                            <td className="py-2">₸ {(oi.quantity * oi.unit_price).toLocaleString("ru-RU")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {next && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleAdvance(order)}
                          disabled={updatingId === order.id}
                          className="btn-primary text-sm"
                        >
                          {updatingId === order.id ? "..." : NEXT_ACTION_LABEL[order.status]}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
