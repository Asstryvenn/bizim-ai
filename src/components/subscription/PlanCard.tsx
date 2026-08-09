"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PlanDefinition } from "@/lib/subscription/plans";
import type { PlanId } from "@/types";

interface Props {
  plan: PlanDefinition;
  currentPlan?: PlanId | null;
  onChoose: (plan: PlanId) => Promise<void>;
}

// Единая карточка тарифа — используется и на /dashboard/pricing, и в PaywallModal,
// чтобы цены/фичи никогда не рассинхронизировались между двумя местами.
export default function PlanCard({ plan, currentPlan, onChoose }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const isCurrent = currentPlan === plan.id;

  const handleClick = async () => {
    if (isCurrent || loading) return;
    setLoading(true);
    try {
      await onChoose(plan.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        plan.recommended ? "border-accent ring-1 ring-accent/30 bg-accent-soft/40" : "border-border bg-card"
      }`}
    >
      {plan.recommended && (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground">
          {t("subscription.checkout.recommended")}
        </span>
      )}

      <h3 className="text-lg font-semibold tracking-tight">{t(plan.nameKey)}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight">${plan.priceUSD}</span>
        <span className="text-ink/50 text-sm">{t("subscription.checkout.perMonth")}</span>
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.featureKeys.map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm text-ink/70">
            <span className="text-success mt-0.5">✓</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleClick}
        disabled={isCurrent || loading}
        className={`mt-6 text-sm py-2.5 ${plan.recommended ? "btn-primary" : "btn-secondary"} ${
          isCurrent ? "opacity-60 cursor-default" : ""
        }`}
      >
        {isCurrent
          ? t("subscription.status.active")
          : loading
            ? t("subscription.checkout.processing")
            : t("subscription.checkout.choosePlan")}
      </button>
    </div>
  );
}
