import type { Sale } from "@/types";

/**
 * Реальная аналитика по продажам товара. Ничего не придумывается: если
 * истории недостаточно для честного расчёта метрики, возвращается null и
 * вызывающий UI обязан показать "Недостаточно данных" вместо цифры.
 *
 * Метод соответствует существующему подходу lib/analytics.ts
 * (filterRowsByRecentDays): "сегодня" для расчёта окон 7/30 дней — это
 * дата САМОЙ СВЕЖЕЙ продажи в истории, а не реальная календарная дата.
 * Это не позволяет разъехавшимся по времени тестовым/старым выгрузкам
 * давать неверные метрики. Прогноз (days_of_stock/stockout) при этом
 * считается от реальной текущей даты, т.к. current_stock — живое значение.
 */

// Минимум различных дней с продажами, ниже которого метрика не считается
// достаточно надёжной, чтобы её показывать как факт.
const MIN_DAYS_FOR_AVERAGE = 7;
const MIN_DAYS_FOR_TREND = 14;

export interface ProductMetrics {
  hasSalesHistory: boolean;
  distinctSaleDays: number;
  salesLast7: number | null;
  salesLast30: number | null;
  averageDailyUsage: number | null;
  medianDailyUsage: number | null;
  trend: "up" | "down" | "flat" | null;
  trendPercent: number | null;
  volatility: number | null; // коэффициент вариации дневного расхода, чем выше — тем нестабильнее спрос
  daysOfStock: number | null;
  stockoutDate: string | null; // YYYY-MM-DD
  recommendedOrderQuantity: number | null;
  lastSaleAt: string | null;
  daysSinceLastSale: number | null;
  isStale: boolean; // последняя продажа была более 30 дней назад
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeProductMetrics(
  sales: Pick<Sale, "sold_at" | "quantity">[],
  params: { currentStock: number | null; minStock: number | null; desiredStock: number }
): ProductMetrics {
  const empty: ProductMetrics = {
    hasSalesHistory: false,
    distinctSaleDays: 0,
    salesLast7: null,
    salesLast30: null,
    averageDailyUsage: null,
    medianDailyUsage: null,
    trend: null,
    trendPercent: null,
    volatility: null,
    daysOfStock: null,
    stockoutDate: null,
    recommendedOrderQuantity: null,
    lastSaleAt: null,
    daysSinceLastSale: null,
    isStale: false,
  };

  if (sales.length === 0) return empty;

  const byDay = new Map<string, number>();
  for (const sale of sales) {
    const key = toDateKey(sale.sold_at);
    byDay.set(key, (byDay.get(key) ?? 0) + sale.quantity);
  }

  const distinctSaleDays = byDay.size;
  const sortedDates = Array.from(byDay.keys()).sort();
  const latestDateKey = sortedDates[sortedDates.length - 1];
  const latestDate = new Date(`${latestDateKey}T00:00:00Z`);

  const daySeries = (windowDays: number, endDate: Date) => {
    const out: number[] = [];
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(endDate);
      d.setUTCDate(d.getUTCDate() - i);
      out.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    return out;
  };

  const last7 = daySeries(7, latestDate);
  const last30 = daySeries(30, latestDate);
  const salesLast7 = last7.reduce((a, b) => a + b, 0);
  const salesLast30 = last30.reduce((a, b) => a + b, 0);

  const hasEnoughForAverage = distinctSaleDays >= MIN_DAYS_FOR_AVERAGE;
  const averageDailyUsage = hasEnoughForAverage ? salesLast30 / 30 : null;
  const medianDailyUsage = hasEnoughForAverage ? median(last30) : null;
  const volatility =
    hasEnoughForAverage && averageDailyUsage && averageDailyUsage > 0
      ? stdDev(last30) / averageDailyUsage
      : null;

  let trend: ProductMetrics["trend"] = null;
  let trendPercent: number | null = null;
  const oldestDate = new Date(`${sortedDates[0]}T00:00:00Z`);
  const historySpanDays = Math.round((latestDate.getTime() - oldestDate.getTime()) / 86400000) + 1;
  if (historySpanDays >= MIN_DAYS_FOR_TREND && distinctSaleDays >= MIN_DAYS_FOR_TREND) {
    const priorWeekEnd = new Date(latestDate);
    priorWeekEnd.setUTCDate(priorWeekEnd.getUTCDate() - 7);
    const priorWeek = daySeries(7, priorWeekEnd);
    const priorSum = priorWeek.reduce((a, b) => a + b, 0);
    if (priorSum > 0) {
      trendPercent = Math.round(((salesLast7 - priorSum) / priorSum) * 100);
      trend = trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : "flat";
    }
  }

  const now = new Date();
  const daysSinceLastSale = Math.round((now.getTime() - latestDate.getTime()) / 86400000);
  const isStale = daysSinceLastSale > 30;

  let daysOfStock: number | null = null;
  let stockoutDate: string | null = null;
  let recommendedOrderQuantity: number | null = null;

  // days_of_stock/stockout/рекомендуемый заказ требуют ЗНАТЬ текущий
  // остаток — если его нет (импорт без колонки остатка), честно оставляем
  // эти поля null вместо того, чтобы считать от несуществующего "0".
  if (averageDailyUsage && averageDailyUsage > 0 && params.currentStock !== null) {
    daysOfStock = params.currentStock / averageDailyUsage;
    const stockout = new Date(now);
    stockout.setUTCDate(stockout.getUTCDate() + Math.floor(daysOfStock));
    stockoutDate = stockout.toISOString().slice(0, 10);

    const minStock = params.minStock ?? 0;
    const coverageTarget =
      params.desiredStock > 0 ? params.desiredStock : Math.max(minStock * 2, averageDailyUsage * 14);
    const qty = coverageTarget - params.currentStock;
    recommendedOrderQuantity = qty > 0 ? Math.ceil(qty) : 0;
  }

  return {
    hasSalesHistory: true,
    distinctSaleDays,
    salesLast7,
    salesLast30,
    averageDailyUsage,
    medianDailyUsage,
    trend,
    trendPercent,
    volatility,
    daysOfStock,
    stockoutDate,
    recommendedOrderQuantity,
    lastSaleAt: sales.reduce((max, s) => (s.sold_at > max ? s.sold_at : max), sales[0].sold_at),
    daysSinceLastSale,
    isStale,
  };
}

// ---------------------------------------------------------------------------
// ABC/XYZ — классификация товаров по реальному обороту и стабильности спроса.
// Считается по всей переданной выборке продаж (обычно 90 дней), а не выдумывается.
// ---------------------------------------------------------------------------

export type AbcClass = "A" | "B" | "C";
export type XyzClass = "X" | "Y" | "Z";

export interface AbcXyzEntry {
  productId: string;
  revenue: number;
  abc: AbcClass | null;
  xyz: XyzClass | null;
}

export function computeAbcXyz(
  products: { id: string; sales: Pick<Sale, "sold_at" | "quantity" | "unit_price">[] }[]
): AbcXyzEntry[] {
  const revenues = products.map((p) => {
    const revenue = p.sales.reduce((sum, s) => sum + s.quantity * (s.unit_price ?? 0), 0);
    return { productId: p.id, revenue };
  });

  const totalRevenue = revenues.reduce((sum, r) => sum + r.revenue, 0);
  const sorted = [...revenues].sort((a, b) => b.revenue - a.revenue);

  const abcByProduct = new Map<string, AbcClass | null>();
  if (totalRevenue > 0) {
    let cumulative = 0;
    for (const r of sorted) {
      cumulative += r.revenue;
      const cumulativeShare = cumulative / totalRevenue;
      abcByProduct.set(r.productId, cumulativeShare <= 0.8 ? "A" : cumulativeShare <= 0.95 ? "B" : "C");
    }
  }

  return products.map((p) => {
    const dailyTotals = new Map<string, number>();
    for (const s of p.sales) {
      const key = toDateKey(s.sold_at);
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + s.quantity);
    }
    const distinctDays = dailyTotals.size;
    let xyz: XyzClass | null = null;
    if (distinctDays >= MIN_DAYS_FOR_AVERAGE) {
      const values = Array.from(dailyTotals.values());
      const m = mean(values);
      const cv = m > 0 ? stdDev(values) / m : null;
      xyz = cv === null ? null : cv <= 0.5 ? "X" : cv <= 1 ? "Y" : "Z";
    }

    return {
      productId: p.id,
      revenue: revenues.find((r) => r.productId === p.id)?.revenue ?? 0,
      abc: totalRevenue > 0 ? abcByProduct.get(p.id) ?? null : null,
      xyz,
    };
  });
}
