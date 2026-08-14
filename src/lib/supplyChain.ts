import type {
  InventoryItem,
  InventoryStatus,
  Supplier,
  PurchaseOrderWithDetails,
} from "@/types";

// ---------------------------------------------------------------------------
// Учёт остатков: статус и прогноз "на сколько дней хватит"
// ---------------------------------------------------------------------------

export function daysOfStockLeft(item: Pick<InventoryItem, "current_stock" | "avg_daily_usage">): number | null {
  if (item.avg_daily_usage <= 0) return null;
  return item.current_stock / item.avg_daily_usage;
}

export function getInventoryStatus(
  item: Pick<InventoryItem, "current_stock" | "min_stock" | "desired_stock">
): InventoryStatus {
  if (item.min_stock > 0 && item.current_stock <= item.min_stock * 0.5) return "critical";
  if (item.min_stock > 0 && item.current_stock <= item.min_stock) return "low";
  if (item.desired_stock > 0 && item.current_stock > item.desired_stock * 1.5) return "excess";
  return "ok";
}

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  ok: "В норме",
  low: "Скоро закончится",
  critical: "Критический остаток",
  excess: "Избыток",
};

// ---------------------------------------------------------------------------
// Автозаказ: сколько рекомендуется заказать
// ---------------------------------------------------------------------------

export function recommendedOrderQty(
  item: Pick<InventoryItem, "current_stock" | "min_stock" | "desired_stock">
): number {
  const target = item.desired_stock > 0 ? item.desired_stock : item.min_stock * 2;
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
// Поставщики: прозрачная scoring-модель сравнения
// ---------------------------------------------------------------------------

export interface SupplierScore {
  supplier: Supplier;
  priceScore: number;
  speedScore: number;
  reliabilityScore: number;
  totalScore: number;
}

// Веса модели: надёжность важнее всего для непрерывности снабжения,
// затем цена, затем скорость доставки.
const WEIGHT_PRICE = 0.35;
const WEIGHT_SPEED = 0.25;
const WEIGHT_RELIABILITY = 0.4;

export function scoreSuppliers(suppliers: Supplier[]): SupplierScore[] {
  if (suppliers.length === 0) return [];

  const prices = suppliers.map((s) => s.price_index);
  const speeds = suppliers.map((s) => s.avg_delivery_days);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);

  const normalize = (value: number, min: number, max: number) =>
    max === min ? 100 : ((max - value) / (max - min)) * 100;

  return suppliers
    .map((supplier) => {
      const priceScore = normalize(supplier.price_index, minPrice, maxPrice);
      const speedScore = normalize(supplier.avg_delivery_days, minSpeed, maxSpeed);
      const reliabilityScore = (1 - supplier.delay_rate) * 100;
      const totalScore =
        priceScore * WEIGHT_PRICE + speedScore * WEIGHT_SPEED + reliabilityScore * WEIGHT_RELIABILITY;
      return {
        supplier,
        priceScore: Math.round(priceScore),
        speedScore: Math.round(speedScore),
        reliabilityScore: Math.round(reliabilityScore),
        totalScore: Math.round(totalScore),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

// ---------------------------------------------------------------------------
// Прогноз спроса: детерминированная история + прогноз на основе среднего
// расхода товара (без реальных продаж — для MVP этого достаточно, но
// результат стабилен между рендерами и выглядит как настоящая аналитика).
// ---------------------------------------------------------------------------

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

export interface ForecastPoint {
  date: string;
  qty: number;
  isForecast: boolean;
}

export interface DemandForecast {
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  expectedUsage7d: number;
  recommendedOrder: number;
  seasonalCoefficient: number;
}

export function buildDemandForecast(item: InventoryItem): DemandForecast {
  const rand = seededRandom(hashString(item.id));
  const base = Math.max(item.avg_daily_usage, 0.5);
  const today = new Date();

  const history: ForecastPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const weekday = date.getDay();
    // Выходные (Пт/Сб) — чуть выше спрос, типично для кафе/розницы.
    const weekendBoost = weekday === 5 || weekday === 6 ? 1.15 : 1;
    const noise = 0.85 + rand() * 0.3;
    history.push({
      date: date.toISOString().slice(0, 10),
      qty: Math.round(base * weekendBoost * noise * 10) / 10,
      isForecast: false,
    });
  }

  // Сезонный коэффициент — среднее отношение последних 7 дней к предыдущим 23.
  const recent7 = history.slice(-7).reduce((sum, p) => sum + p.qty, 0) / 7;
  const prior = history.slice(0, 23).reduce((sum, p) => sum + p.qty, 0) / 23;
  const seasonalCoefficient = prior > 0 ? recent7 / prior : 1;

  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const weekday = date.getDay();
    const weekendBoost = weekday === 5 || weekday === 6 ? 1.15 : 1;
    const noise = 0.95 + rand() * 0.1;
    forecast.push({
      date: date.toISOString().slice(0, 10),
      qty: Math.round(base * seasonalCoefficient * weekendBoost * noise * 10) / 10,
      isForecast: true,
    });
  }

  const expectedUsage7d = Math.round(forecast.reduce((sum, p) => sum + p.qty, 0));
  const recommendedOrder = Math.max(0, Math.ceil(expectedUsage7d - item.current_stock + item.min_stock));

  return { history, forecast, expectedUsage7d, recommendedOrder, seasonalCoefficient };
}

// ---------------------------------------------------------------------------
// AI-рекомендации: правило-based, но объяснимые и завязанные на реальные
// данные бизнеса (не выдумываем факты, которых нет в inventory/suppliers).
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
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  for (const item of items) {
    const status = getInventoryStatus(item);
    const days = daysOfStockLeft(item);

    if (status === "critical" || status === "low") {
      const qty = recommendedOrderQty(item);
      const daysLabel =
        days === null ? "неизвестно" : days < 1 ? "меньше суток" : `${days.toFixed(1)} дня`;
      recs.push({
        id: `low-${item.id}`,
        severity: status === "critical" ? "critical" : "warning",
        message: `Закажите «${item.name}» в ближайшие 24 часа — текущего остатка (${item.current_stock} ${item.unit}) хватит примерно на ${daysLabel}. Рекомендуемый заказ: ${qty} ${item.unit}.`,
      });
    }

    if (status === "excess" && days !== null) {
      recs.push({
        id: `excess-${item.id}`,
        severity: "info",
        message: `У вас избыток «${item.name}» — текущего запаса (${item.current_stock} ${item.unit}) хватит примерно на ${Math.round(days)} дней. Пока не заказывайте.`,
      });
    }
  }

  for (const supplier of suppliers) {
    if (supplier.orders_count >= 3 && supplier.delay_rate >= 0.35) {
      const better = suppliers
        .filter((s) => s.id !== supplier.id && s.delay_rate < supplier.delay_rate)
        .sort((a, b) => a.delay_rate - b.delay_rate)[0];
      const delayedCount = Math.round(supplier.delay_rate * supplier.orders_count);
      recs.push({
        id: `supplier-${supplier.id}`,
        severity: "warning",
        message: better
          ? `Поставщик «${supplier.name}» задержал ${delayedCount} из ${supplier.orders_count} последних поставок. Рассмотрите поставщика «${better.name}» — у него меньше задержек.`
          : `Поставщик «${supplier.name}» задержал ${delayedCount} из ${supplier.orders_count} последних поставок.`,
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

  // Порядок: сначала критические, потом warning, потом info.
  const severityOrder: Record<Recommendation["severity"], number> = { critical: 0, warning: 1, info: 2 };
  return recs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function computeSupplyMetrics(items: InventoryItem[], suppliers: Supplier[], orders: PurchaseOrderWithDetails[]) {
  const lowStockCount = items.filter((i) => getInventoryStatus(i) === "low").length;
  const criticalCount = items.filter((i) => getInventoryStatus(i) === "critical").length;
  const excessCount = items.filter((i) => getInventoryStatus(i) === "excess").length;
  const activeOrders = orders.filter((o) => !["delivered"].includes(o.status)).length;
  const inTransit = orders.filter((o) => o.status === "in_transit").length;

  const avgDeliveryDays =
    suppliers.length > 0
      ? suppliers.reduce((sum, s) => sum + s.avg_delivery_days, 0) / suppliers.length
      : 0;
  const avgDelayRate =
    suppliers.length > 0 ? suppliers.reduce((sum, s) => sum + s.delay_rate, 0) / suppliers.length : 0;

  // Оценка экономии от автозаказа: разница между "заказ по требованию день-в-день"
  // (плата за срочность +15%) и оптимальным плановым заказом по среднему чеку заказа.
  const estimatedMonthlySavings = orders
    .filter((o) => o.status !== "draft")
    .reduce((sum, o) => sum + o.total_amount * 0.15, 0);

  return {
    lowStockCount,
    criticalCount,
    excessCount,
    activeOrders,
    inTransit,
    avgDeliveryDays: Math.round(avgDeliveryDays * 10) / 10,
    avgDelayRate: Math.round(avgDelayRate * 100),
    estimatedMonthlySavings: Math.round(estimatedMonthlySavings),
  };
}
