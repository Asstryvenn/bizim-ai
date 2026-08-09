"use client";

import { useTranslation } from "react-i18next";
import { PLAN_DEFINITIONS } from "@/lib/subscription/plans";
import { useCheckout } from "@/lib/subscription/useCheckout";
import PlanCard from "@/components/subscription/PlanCard";
import type { PlanId } from "@/types";

export default function PricingPlans({ currentPlan }: { currentPlan: PlanId | null }) {
  const { t } = useTranslation();
  const choosePlan = useCheckout();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t("subscription.page.title")}</h1>
      <p className="mt-2 text-ink/60">{t("subscription.page.subtitle")}</p>

      <div className="mt-8 grid sm:grid-cols-3 gap-6">
        {PLAN_DEFINITIONS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} currentPlan={currentPlan} onChoose={choosePlan} />
        ))}
      </div>

      <p className="mt-6 text-xs text-ink/40 text-center max-w-2xl mx-auto">
        {t("subscription.checkout.demoNotice")}
      </p>
    </div>
  );
}
