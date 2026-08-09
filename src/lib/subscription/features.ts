import type { PlanId, Subscription } from "@/types";
import { PLAN_RANK } from "@/lib/subscription/plans";

/**
 * Единственное место, где перечислены платные фичи Bizim и минимальный
 * тариф, открывающий каждую из них. UI (FeatureGate/paywall) и API routes
 * (requireFeature на сервере) читают ТОЛЬКО отсюда — никаких проверок
 * "plan === 'growth'" не должно быть разбросано по компонентам/роутам.
 *
 * Добавление новой платной фичи = одна строка здесь.
 */
export type FeatureKey =
  // Starter+
  | "excel_import"
  | "basic_ai_analysis"
  | "customer_insights"
  | "basic_recommendations"
  | "ai_content"
  | "campaigns"
  // Growth+
  | "advanced_ai_analysis"
  | "external_signals"
  | "smart_alerts"
  | "campaign_intelligence"
  | "promotions_loyalty"
  // Pro+ (архитектура готова; UI для них появится вместе с фичами из
  // FUTURE ROADMAP — automation/realtime monitoring/POS-CRM-1С и т.д.)
  | "automation"
  | "realtime_monitoring"
  | "continuous_recommendations"
  | "advanced_customer_intelligence"
  | "automated_campaigns";

export const FEATURE_MIN_PLAN: Record<FeatureKey, PlanId> = {
  excel_import: "starter",
  basic_ai_analysis: "starter",
  customer_insights: "starter",
  basic_recommendations: "starter",
  ai_content: "starter",
  campaigns: "starter",

  advanced_ai_analysis: "growth",
  external_signals: "growth",
  smart_alerts: "growth",
  campaign_intelligence: "growth",
  promotions_loyalty: "growth",

  automation: "pro",
  realtime_monitoring: "pro",
  continuous_recommendations: "pro",
  advanced_customer_intelligence: "pro",
  automated_campaigns: "pro",
};

/** true только если подписка реально активна (не canceled/past_due/inactive). */
export function hasActiveSubscription(subscription: Subscription | null | undefined): boolean {
  return subscription?.status === "active";
}

/**
 * Центральная проверка доступа. Используется и в UI (что показать —
 * фичу или paywall), и на сервере (пропустить запрос или вернуть 402).
 * Ничего, кроме status==="active" и ранга тарифа, не решает доступ —
 * никаких "special case" исключений.
 */
export function hasFeature(
  subscription: Subscription | null | undefined,
  feature: FeatureKey
): boolean {
  if (!hasActiveSubscription(subscription)) return false;
  const required = FEATURE_MIN_PLAN[feature];
  return PLAN_RANK[subscription!.plan] >= PLAN_RANK[required];
}
