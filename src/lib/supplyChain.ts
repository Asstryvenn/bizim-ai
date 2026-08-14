import type { InventoryItem, InventoryStatus, Sale, Supplier, PurchaseOrderWithDetails } from "@/types";
import { computeProductMetrics } from "@/lib/salesAnalytics";

// ---------------------------------------------------------------------------
// Учёт остатков: статус и прогноз "на сколько дней хватит"
// Приоритет всегда у РЕАЛЬНО ПОСЧИТАННОГО days_of_stock/forecast_daily_usage
// (из sales, см. lib/salesAnalytics.ts и /api/import/products) — avg_daily_usage
// используется только как ручной fallback, пока нет истории продаж.
// ---------------------------------------------------------------------------

export function effectiveDailyUsage(
  item: Pick<InventoryItem, "avg_daily_usage" | "forecast_daily_usage">
): { value: number | null; isComputed: boolean } {
  if (item.forecast_daily_usage !== null && item.forecast_daily_usage !== undefined) {
    return { value: item.forecast_daily_usage, isComputed: true };
  }
  if (item.avg_daily_usage > 0) {
    return { value: item.avg_daily_usage, isComputed: false };
  }
  return { value: null, isComputed: false };
}

export function daysOfStockLeft(
  item: Pick<InventoryItem, "current_stock" | "avg_daily_usage" | "forecast_daily_usage" | "days_of_stock">
): number | null {
  if (item.days_of_stock !== null && item.days_of_stock !== undefined) return item.days_of_stock;
  if (item.current_stock === null) return null;
  const { value } = effectiveDailyUsage(item);
  if (!value || value <= 0) return null;
  return item.current_stock / value;
}

export function getInventoryStatus(
  item: Pick<InventoryItem, "current_stock" | "min_stock" | "desired_stock">
): InventoryStatus {
  if (item.current_stock === null) return "unknown";
  if (item.min_stock !== null && item.min_stock > 0 && item.current_stock <= item.min_stock * 0.5) return "critical";
  if (item.min_stock !== null && item.min_stock > 0 && item.current_stock <= item.min_stock) return "low";
  if (item.desired_stock > 0 && item.current_stock > item.desired_stock * 1.5) return "excess";
  return "ok";
}

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  ok: "В норме",
  low: "Скоро закончится",
  critical: "Критический остаток",
  excess: "Избыток",
  unknown: "Остаток не указан",
};

// ---------------------------------------------------------------------------
// Автозаказ: сколько рекомендуется заказать
// ---------------------------------------------------------------------------

export function recommendedOrderQty(
  item: Pick<InventoryItem, "current_stock" | "min_stock" | "desired_stock">
): number | null {
  if (item.current_stock === null) return null;
  const minStock = item.min_stock ?? 0;
  const target = item.desired_stock > 0 ? item.desired_stock : minStock * 2;
  const qty = target - item.current_stock;
  return qty > 0 ? Math.ceil(qty) : 0;
}

export function needsReorder(
  item: Pick<InventoryItem, "current_stock" | "min_stock" | "desired_stock">
): boolean {
  const status = getInventoryStatus(item);
  return status === "low" || status === "critical";
}

// ---------------------------------------------------------------------------
// Поставщики: метрики скорости/надёжности считаются из РЕАЛЬНОЙ истории
// purchase_orders этого поставщика, а не вводятся вручную при добавлении
// (раньше price_index/avg_delivery_days/delay_rate заполнялись "на глаз"
// сразу для нового поставщика — это и есть придуманные данные).
// ---------------------------------------------------------------------------

const MIN_ORDERS_FOR_SUPPLIER_METRICS = 2;

export interface SupplierMetrics {
  hasEnoughData: boolean;
  ordersCount: number;
  deliveredCount: number;
  avgDeliveryDays: number | null;
  delayRate: number | null;
}

export function computeSupplierMetrics(supplierId: string, orders: PurchaseOrderWithDetails[]): SupplierMetrics {
  const supplierOrders = orders.filter((o) => o.supplier_id === supplierId && o.status !== "draft");
  const delivered = supplierOrders.filter((o) => o.status === "delivered" && o.actual_delivery);
  const delayed = supplierOrders.filter((o) => o.status === "delayed");

  const hasEnoughData = supplierOrders.length >= MIN_ORDERS_FOR_SUPPLIER_METRICS;

  const avgDeliveryDays =
    delivered.length > 0
      ? delivered.reduce((sum, o) => {
          const days = (new Date(o.actual_delivery!).getTime() - new Date(o.created_at).getTime()) / 86400000;
          return sum + Math.max(days, 0);
        }, 0) / delivered.length
      : null;

  const delayRate = hasEnoughData ? delayed.length / supplierOrders.length : null;

  return {
    hasEnoughData,
    ordersCount: supplierOrders.length,
    deliveredCount: delivered.length,
    avgDeliveryDays,
    delayRate,
  };
}

export interface SupplierScore {
  supplier: Supplier;
  metrics: SupplierMetrics;
  speedScore: number | null;
  reliabilityScore: number | null;
  totalScore: number | null;
}

export function scoreSuppliers(suppliers: Supplier[], orders: PurchaseOrderWithDetails[]): SupplierScore[] {
  if (suppliers.length === 0) return [];

  const withMetrics = suppliers.map((supplier) => ({
    supplier,
    metrics: computeSupplierMetrics(supplier.id, orders),
  }));

  const ratedSpeeds = withMetrics
    .map((s) => s.metrics.avgDeliveryDays)
    .filter((v): v is number => v !== null);
  const minSpeed = ratedSpeeds.length > 0 ? Math.min(...ratedSpeeds) : 0;
  const maxSpeed = ratedSpeeds.length > 0 ? Math.max(...ratedSpeeds) : 0;
  const normalize = (value: number, min: number, max: number) =>
    max === min ? 100 : ((max - value) / (max - min)) * 100;

  return withMetrics
    .map(({ supplier, metrics }) => {
      if (!metrics.hasEnoughData || metrics.avgDeliveryDays === null || metrics.delayRate === null) {
        return { supplier, metrics, speedScore: null, reliabilityScore: null, totalScore: null };
      }
      const speedScore = Math.round(normalize(metrics.avgDeliveryDays, minSpeed, maxSpeed));
      const reliabilityScore = Math.round((1 - metrics.delayRate) * 100);
      const totalScore = Math.round(speedScore * 0.4 + reliabilityScore * 0.6);
      return { supplier, metrics, speedScore, reliabilityScore, totalScore };
    })
    .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
}

// ---------------------------------------------------------------------------
// AI-рекомендации: правило-based, завязаны только на реальные данные
// (sales, inventory_items, purchase_orders). Если данных недостаточно для
// вывода — рекомендация просто не создаётся, а не заменяется догадкой.
// ---------------------------------------------------------------------------

export interface Recommendation {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
}

export function generateRecommendations(
  items: InventoryItem[],
  suppliers: Supplier[],
  orders: PurchaseOrderWithDetails[]
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const item of items) {
    const status = getInventoryStatus(item);
    const days = daysOfStockLeft(item);

    if ((status === "critical" || status === "low") && item.current_stock !== null) {
      const qty = recommendedOrderQty(item) ?? 0;
      const daysLabel =
        days === null ? "неизвестно" : days < 1 ? "меньше суток" : `${days.toFixed(1)} дня`;
      recs.push({
        id: `low-${item.id}`,
        severity: status === "critical" ? "critical" : "warning",
        message: `Закажите «${item.name}» в ближайшие 24 часа — текущего остатка (${item.current_stock} ${item.unit}) хватит примерно на ${daysLabel}. Рекомендуемый заказ: ${qty} ${item.unit}.`,
      });
    }

    if (status === "excess" && days !== null && item.current_stock !== null) {
      recs.push({
        id: `excess-${item.id}`,
        severity: "info",
        message: `У вас избыток «${item.name}» — текущего запаса (${item.current_stock} ${item.unit}) хватит примерно на ${Math.round(days)} дней. Пока не заказывайте.`,
      });
    }
  }

  for (const supplier of suppliers) {
    const metrics = computeSupplierMetrics(supplier.id, orders);
    if (metrics.hasEnoughData && metrics.delayRate !== null && metrics.delayRate >= 0.35) {
      const better = suppliers
        .filter((s) => s.id !== supplier.id)
        .map((s) => ({ s, m: computeSupplierMetrics(s.id, orders) }))
        .filter((x) => x.m.hasEnoughData && x.m.delayRate !== null && x.m.delayRate < metrics.delayRate!)
        .sort((a, b) => a.m.delayRate! - b.m.delayRate!)[0]?.s;

      const delayedCount = Math.round(metrics.delayRate * metrics.ordersCount);
      recs.push({
        id: `supplier-${supplier.id}`,
        severity: "warning",
        message: better
          ? `Поставщик «${supplier.name}» задержал ${delayedCount} из ${metrics.ordersCount} последних поставок. Рассмотрите поставщика «${better.name}» — у него меньше задержек.`
          : `Поставщик «${supplier.name}» задержал ${delayedCount} из ${metrics.ordersCount} последних поставок.`,
      });
    }
  }

  const inTransitDelayed = orders.filter((o) => o.status === "delayed");
  for (const order of inTransitDelayed) {
    recs.push({
      id: `order-${order.id}`,
      severity: "warning",
      message: `Заказ поставщику «${order.supplier?.name ?? "неизвестен"}» задержан. Проверьте статус доставки.`,
    });
  }

  const severityOrder: Record<Recommendation["severity"], number> = { critical: 0, warning: 1, info: 2 };
  return recs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function computeSupplyMetrics(items: InventoryItem[], suppliers: Supplier[], orders: PurchaseOrderWithDetails[]) {
  const lowStockCount = items.filter((i) => getInventoryStatus(i) === "low").length;
  const criticalCount = items.filter((i) => getInventoryStatus(i) === "critical").length;
  const excessCount = items.filter((i) => getInventoryStatus(i) === "excess").length;
  const activeOrders = orders.filter((o) => o.status !== "delivered").length;
  const inTransit = orders.filter((o) => o.status === "in_transit").length;

  const supplierMetrics = suppliers
    .map((s) => computeSupplierMetrics(s.id, orders))
    .filter((m) => m.hasEnoughData);
  const avgDeliveryDays =
    supplierMetrics.length > 0
      ? supplierMetrics.reduce((sum, m) => sum + (m.avgDeliveryDays ?? 0), 0) / supplierMetrics.length
      : null;
  const avgDelayRate =
    supplierMetrics.length > 0
      ? supplierMetrics.reduce((sum, m) => sum + (m.delayRate ?? 0), 0) / supplierMetrics.length
      : null;

  return {
    lowStockCount,
    criticalCount,
    excessCount,
    activeOrders,
    inTransit,
    avgDeliveryDays: avgDeliveryDays !== null ? Math.round(avgDeliveryDays * 10) / 10 : null,
    avgDelayRate: avgDelayRate !== null ? Math.round(avgDelayRate * 100) : null,
  };
}

// ---------------------------------------------------------------------------
// Прогноз спроса: строится ТОЛЬКО из реальной истории sales. Если истории
// недостаточно (< 14 дней с продажами), возвращается hasEnoughData: false —
// UI обязан честно показать "недостаточно данных", а не рисовать график.
// ---------------------------------------------------------------------------

export interface DemandForecastPoint {
  date: string;
  qty: number;
  isForecast: boolean;
}

export interface DemandForecastResult {
  hasEnoughData: boolean;
  history: DemandForecastPoint[];
  forecast: DemandForecastPoint[];
  expectedUsage7d: number | null;
  recommendedOrder: number | null;
  distinctSaleDays: number;
}

export function buildDemandForecast(
  item: Pick<InventoryItem, "id" | "current_stock" | "min_stock" | "desired_stock">,
  sales: Pick<Sale, "sold_at" | "quantity">[]
): DemandForecastResult {
  const metrics = computeProductMetrics(sales, {
    currentStock: item.current_stock,
    minStock: item.min_stock,
    desiredStock: item.desired_stock,
  });

  if (!metrics.hasSalesHistory || metrics.averageDailyUsage === null) {
    return {
      hasEnoughData: false,
      history: [],
      forecast: [],
      expectedUsage7d: null,
      recommendedOrder: null,
      distinctSaleDays: metrics.distinctSaleDays,
    };
  }

  const byDay = new Map<string, number>();
  for (const s of sales) {
    const key = s.sold_at.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + s.quantity);
  }
  const sortedDays = Array.from(byDay.keys()).sort();
  const last30Days = sortedDays.slice(-30);
  const history: DemandForecastPoint[] = last30Days.map((date) => ({
    date,
    qty: byDay.get(date) ?? 0,
    isForecast: false,
  }));

  // Прогноз на 7 дней вперёд — простая экспоненциально взвешенная средняя
  // (больше веса недавним дням), без случайного шума.
  const base = metrics.averageDailyUsage;
  const trendMultiplier =
    metrics.trend === "up" ? 1 + Math.min(metrics.trendPercent ?? 0, 50) / 100 : metrics.trend === "down" ? 1 + Math.max(metrics.trendPercent ?? 0, -50) / 100 : 1;

  const latestDate = new Date(`${sortedDays[sortedDays.length - 1]}T00:00:00Z`);
  const forecast: DemandForecastPoint[] = [];
  for (let i = 1; i <= 7; i++) {
    const date = new Date(latestDate);
    date.setUTCDate(date.getUTCDate() + i);
    forecast.push({
      date: date.toISOString().slice(0, 10),
      qty: Math.round(base * trendMultiplier * 10) / 10,
      isForecast: true,
    });
  }

  const expectedUsage7d = Math.round(forecast.reduce((sum, p) => sum + p.qty, 0));

  return {
    hasEnoughData: true,
    history,
    forecast,
    expectedUsage7d,
    recommendedOrder: metrics.recommendedOrderQuantity,
    distinctSaleDays: metrics.distinctSaleDays,
  };
}
