import type { Business, InventoryItem, PurchaseOrderWithDetails, Sale, Supplier } from "@/types";
import { computeProductMetrics } from "@/lib/salesAnalytics";
import { getInventoryStatus, daysOfStockLeft, recommendedOrderQty } from "@/lib/supplyChain";

// Структурированный AI-анализ по образцу задания: { summary, insights, risks,
// recommendations, actions }. ВАЖНО: это не вызов LLM — это детерминированная
// интерпретация уже посчитанных backend-метрик (computeProductMetrics,
// supplyChain.ts). Числа никогда не изобретаются заново на этом слое,
// только оборачиваются в понятный текст. Если данных недостаточно для
// какого-то раздела — он остаётся пустым массивом, а не выдуманным.

export type Severity = "info" | "low" | "medium" | "high";

export interface AnalysisInsight {
  title: string;
  description: string;
  severity: Severity;
}

export interface AnalysisRisk {
  title: string;
  description: string;
  severity: Severity;
  product_id?: string;
}

export interface AnalysisRecommendation {
  title: string;
  reason: string;
  supplier_id?: string;
  product_id?: string;
  quantity?: number;
}

export interface AnalysisAction {
  type: "CREATE_ORDER_DRAFT";
  product_id: string;
  supplier_id?: string;
  quantity: number;
}

export interface StructuredAnalysis {
  summary: string[];
  insights: AnalysisInsight[];
  risks: AnalysisRisk[];
  recommendations: AnalysisRecommendation[];
  actions: AnalysisAction[];
  insufficient_data: string[];
}

export function buildStructuredAnalysis(
  business: Business,
  items: InventoryItem[],
  salesByProduct: Map<string, Sale[]>,
  suppliers: Supplier[],
  orders: PurchaseOrderWithDetails[]
): StructuredAnalysis {
  const insights: AnalysisInsight[] = [];
  const risks: AnalysisRisk[] = [];
  const recommendations: AnalysisRecommendation[] = [];
  const actions: AnalysisAction[] = [];
  const insufficientData: string[] = [];

  if (items.length === 0) {
    insufficientData.push("Нет товаров — импортируйте продажи или добавьте товары вручную.");
  }

  const supplierByItem = new Map(items.map((i) => [i.id, i.supplier_id ? suppliers.find((s) => s.id === i.supplier_id) : null]));

  for (const item of items) {
    const status = getInventoryStatus(item);
    const days = daysOfStockLeft(item);
    const sales = salesByProduct.get(item.id) ?? [];
    const metrics = computeProductMetrics(sales, {
      currentStock: item.current_stock,
      minStock: item.min_stock,
      desiredStock: item.desired_stock,
    });

    // RISK: критический/низкий остаток с реальным сроком.
    if ((status === "critical" || status === "low") && days !== null) {
      risks.push({
        title: `«${item.name}» закончится примерно через ${days < 1 ? "меньше суток" : `${days.toFixed(1)} дня`}`,
        description: `Остаток: ${item.current_stock} ${item.unit}. Средний расход: ${metrics.averageDailyUsage?.toFixed(1) ?? item.avg_daily_usage} ${item.unit}/день.`,
        severity: status === "critical" ? "high" : "medium",
        product_id: item.id,
      });

      const qty = recommendedOrderQty(item);
      const supplier = supplierByItem.get(item.id);
      if (qty !== null && qty > 0) {
        recommendations.push({
          title: `Заказать ${qty} ${item.unit} «${item.name}»`,
          reason: supplier
            ? `Остаток ниже точки заказа, поставщик «${supplier.name}» уже привязан к товару.`
            : "Остаток ниже точки заказа. Поставщик пока не привязан к товару.",
          supplier_id: supplier?.id,
          product_id: item.id,
          quantity: qty,
        });
        actions.push({
          type: "CREATE_ORDER_DRAFT",
          product_id: item.id,
          supplier_id: supplier?.id,
          quantity: qty,
        });
      }
    } else if (status === "unknown" && sales.length > 0) {
      insufficientData.push(`«${item.name}»: остаток не указан — риск дефицита нельзя оценить.`);
    }

    // INSIGHT: реальный тренд роста/падения спроса.
    if (metrics.trend === "up" && metrics.trendPercent !== null && metrics.trendPercent >= 15) {
      insights.push({
        title: `Спрос на «${item.name}» растёт`,
        description: `Продажи за последние 7 дней выросли на ${metrics.trendPercent}% относительно предыдущей недели.`,
        severity: "info",
      });
    } else if (metrics.trend === "down" && metrics.trendPercent !== null && metrics.trendPercent <= -15) {
      insights.push({
        title: `Спрос на «${item.name}» падает`,
        description: `Продажи за последние 7 дней снизились на ${Math.abs(metrics.trendPercent)}% относительно предыдущей недели.`,
        severity: "low",
      });
    }

    if (status === "excess" && days !== null) {
      insights.push({
        title: `Избыток «${item.name}»`,
        description: `Текущего запаса (${item.current_stock} ${item.unit}) хватит примерно на ${Math.round(days)} дней — заказывать пока не нужно.`,
        severity: "info",
      });
    }
  }

  // Заказы, задержанные во внешней системе.
  for (const order of orders) {
    if (order.status === "delayed") {
      risks.push({
        title: `Заказ у поставщика «${order.supplier?.name ?? "неизвестен"}» задержан`,
        description: "Проверьте статус доставки вручную или свяжитесь с поставщиком.",
        severity: "medium",
      });
    }
  }

  const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  risks.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const summary: string[] = [];
  if (risks.length > 0) {
    summary.push(`${risks.filter((r) => r.severity === "high").length} товара под риском дефицита`);
  }
  if (recommendations.length > 0) {
    summary.push(`${recommendations.length} рекомендаций по закупке`);
  }
  if (summary.length === 0 && items.length > 0) {
    summary.push("Критичных проблем не обнаружено");
  }
  if (items.length === 0) {
    summary.push("Недостаточно данных — импортируйте продажи или добавьте товары");
  }

  return {
    summary,
    insights,
    risks,
    recommendations,
    actions,
    insufficient_data: insufficientData,
  };
}
