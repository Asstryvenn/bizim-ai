import type { PlanId } from "@/types";

/**
 * Единственное место с определением тарифов Bizim. UI (pricing page,
 * paywall) и backend (feature-гейты) читают отсюда — цифры/фичи нигде
 * не дублируются вручную.
 */
export interface PlanDefinition {
  id: PlanId;
  nameKey: string; // i18n key
  priceUSD: number;
  featureKeys: string[]; // i18n keys для списка фич на pricing/paywall
  recommended?: boolean;
}

export const PLAN_RANK: Record<PlanId, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "starter",
    nameKey: "subscription.plans.starter.name",
    priceUSD: 19,
    featureKeys: [
      "subscription.plans.starter.features.dashboard",
      "subscription.plans.starter.features.excelImport",
      "subscription.plans.starter.features.basicAnalysis",
      "subscription.plans.starter.features.customerInsights",
      "subscription.plans.starter.features.basicRecommendations",
      "subscription.plans.starter.features.limitedContent",
      "subscription.plans.starter.features.limitedCampaigns",
    ],
  },
  {
    id: "growth",
    nameKey: "subscription.plans.growth.name",
    priceUSD: 39,
    recommended: true,
    featureKeys: [
      "subscription.plans.growth.features.everythingStarter",
      "subscription.plans.growth.features.advancedAnalysis",
      "subscription.plans.growth.features.externalSignals",
      "subscription.plans.growth.features.smartAlerts",
      "subscription.plans.growth.features.campaignIntelligence",
      "subscription.plans.growth.features.promotions",
      "subscription.plans.growth.features.moreCampaigns",
      "subscription.plans.growth.features.messagingPrepared",
    ],
  },
  {
    id: "pro",
    nameKey: "subscription.plans.pro.name",
    priceUSD: 79,
    featureKeys: [
      "subscription.plans.pro.features.everythingGrowth",
      "subscription.plans.pro.features.automation",
      "subscription.plans.pro.features.realtimeMonitoring",
      "subscription.plans.pro.features.continuousRecommendations",
      "subscription.plans.pro.features.advancedCustomerIntelligence",
      "subscription.plans.pro.features.automatedCampaigns",
      "subscription.plans.pro.features.priorityAI",
      "subscription.plans.pro.features.futureIntegrations",
      "subscription.plans.pro.features.highestLimits",
    ],
  },
];

export function getPlanDefinition(plan: PlanId): PlanDefinition {
  const def = PLAN_DEFINITIONS.find((p) => p.id === plan);
  if (!def) throw new Error(`Unknown plan: ${plan}`);
  return def;
}
