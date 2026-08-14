import Link from "next/link";
import {
  computeSupplyMetrics,
  generateRecommendations,
  getInventoryStatus,
  daysOfStockLeft,
  effectiveDailyUsage,
} from "@/lib/supplyChain";
import type { InventoryItem, PurchaseOrderWithDetails, Supplier } from "@/types";

interface SupplyChainSummaryProps {
  items: InventoryItem[];
  suppliers: Supplier[];
  orders: PurchaseOrderWithDetails[];
}

export default function SupplyChainSummary({ items, suppliers, orders }: SupplyChainSummaryProps) {
  if (items.length === 0 && suppliers.length === 0 && orders.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">📦 Снабжение и логистика</h2>
            <p className="text-ink/50 mt-1 text-sm">
              Управляйте запасами и закупками без сложной ERP — добавьте первый товар, чтобы начать.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/inventory" className="btn-primary shrink-0">
              Проверить остатки
            </Link>
            <Link href="/dashboard/suppliers" className="btn-secondary shrink-0">
              Добавить поставщика
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const metrics = computeSupplyMetrics(items, suppliers, orders);
  const attention = items
    .filter((i) => {
      const s = getInventoryStatus(i);
      return s === "low" || s === "critical";
    })
    .slice(0, 3);
  const recommendations = generateRecommendations(items, suppliers, orders).slice(0, 3);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">📦 Снабжение и логистика</h2>
          <p className="text-ink/50 mt-1 text-sm">Что происходит с запасами и заказами прямо сейчас</p>
        </div>
        <Link href="/dashboard/inventory" className="btn-primary shrink-0">
          Проверить остатки
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-mist p-4">
          <p className="text-xs text-ink/50">Товаров на исходе</p>
          <p className="mt-1 text-2xl font-bold">{metrics.lowStockCount + metrics.criticalCount}</p>
        </div>
        <div className="rounded-xl bg-mist p-4">
          <p className="text-xs text-ink/50">Заказов в пути</p>
          <p className="mt-1 text-2xl font-bold">{metrics.inTransit}</p>
        </div>
        <div className="rounded-xl bg-mist p-4">
          <p className="text-xs text-ink/50">Ср. срок доставки</p>
          <p className="mt-1 text-2xl font-bold">
            {metrics.avgDeliveryDays !== null ? `${metrics.avgDeliveryDays} дн.` : "нет данных"}
          </p>
        </div>
        <div className="rounded-xl bg-mist p-4">
          <p className="text-xs text-ink/50">Риск дефицита</p>
          <p className="mt-1 text-2xl font-bold text-danger">{metrics.criticalCount} товара</p>
        </div>
      </div>

      {attention.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-ink/70 mb-3">Требуют внимания</h3>
          <div className="space-y-2">
            {attention.map((item) => {
              const days = daysOfStockLeft(item);
              const usage = effectiveDailyUsage(item);
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-ink/50">
                      Остаток: {item.current_stock} {item.unit}
                      {usage.value !== null && ` · Средний расход: ${usage.value.toFixed(1)} ${item.unit}/день`}
                      {days !== null && ` · Хватит примерно на ${days < 1 ? "меньше суток" : `${days.toFixed(1)} дня`}`}
                    </p>
                  </div>
                  <Link href="/dashboard/inventory" className="btn-secondary text-xs py-1.5 px-3 shrink-0">
                    Заказать сейчас
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-ink/70">Рекомендации AI</h3>
            <Link href="/dashboard/recommendations" className="text-xs text-accent font-medium">
              Все рекомендации →
            </Link>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <p key={rec.id} className="text-sm text-ink/70 leading-relaxed rounded-xl bg-accent-soft/60 p-3">
                {rec.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
