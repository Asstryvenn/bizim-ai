"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Subscription } from "@/types";
import { hasFeature, type FeatureKey } from "@/lib/subscription/features";
import PaywallModal from "@/components/subscription/PaywallModal";

interface Props {
  subscription: Subscription | null;
  feature: FeatureKey;
  children: React.ReactNode;
}

// Единственное место, откуда Dashboard решает "показать фичу или paywall".
// Никаких `if (plan === "growth")` в самих секциях дашборда — только
// FeatureGate + hasFeature() (src/lib/subscription/features.ts).
export default function FeatureGate({ subscription, feature, children }: Props) {
  const { t } = useTranslation();
  const [paywallOpen, setPaywallOpen] = useState(false);

  if (hasFeature(subscription, feature)) {
    return <>{children}</>;
  }

  return (
    <>
      <section className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
        <p className="text-4xl">🔒</p>
        <h3 className="mt-3 font-semibold tracking-tight">{t("subscription.paywall.title")}</h3>
        <p className="mt-1 text-sm text-ink/50">{t("subscription.paywall.subtitle")}</p>
        <button
          type="button"
          onClick={() => setPaywallOpen(true)}
          className="btn-primary mt-5 inline-flex text-sm py-2 px-5"
        >
          {t("subscription.paywall.cta")}
        </button>
      </section>

      {paywallOpen && (
        <PaywallModal currentPlan={subscription?.plan} onClose={() => setPaywallOpen(false)} />
      )}
    </>
  );
}
