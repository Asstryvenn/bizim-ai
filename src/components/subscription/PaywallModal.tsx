"use client";

import { useTranslation } from "react-i18next";
import { PLAN_DEFINITIONS } from "@/lib/subscription/plans";
import { useCheckout } from "@/lib/subscription/useCheckout";
import PlanCard from "@/components/subscription/PlanCard";
import type { PlanId } from "@/types";

interface Props {
  currentPlan?: PlanId | null;
  onClose: () => void;
}

// "Choose a plan to unlock Bizim AI" — модалка, которую FeatureGate
// открывает вместо того, чтобы выполнить заблокированное действие.
export default function PaywallModal({ currentPlan, onClose }: Props) {
  const { t } = useTranslation();
  const choosePlan = useCheckout(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card animate-fade-in-up my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {t("subscription.paywall.title")}
            </h2>
            <p className="mt-1 text-sm text-ink/60">{t("subscription.paywall.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full h-8 w-8 flex items-center justify-center text-ink/40 hover:bg-mist hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          {PLAN_DEFINITIONS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} currentPlan={currentPlan} onChoose={choosePlan} />
          ))}
        </div>

        <p className="mt-5 text-xs text-ink/40 text-center">
          {t("subscription.checkout.demoNotice")}
        </p>
      </div>
    </div>
  );
}
