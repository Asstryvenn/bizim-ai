"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { AIRecommendationItem, CampaignSeed } from "@/lib/aiInsights";

const CARD = "rounded-2xl border border-border bg-card p-6 shadow-card";

// AI-слой поверх существующего Growth Tools flow: НЕ трогает /api/tools/generate
// и Excel Import. Если у рекомендации есть campaignSeed — CTA открывает
// внутренний Campaign Builder (см. DashboardView + CampaignBuilderModal)
// вместо перехода на #import-panel; иначе поведение как раньше (Link).
export default function CampaignIntelligence({
  topRecommendation,
  createdIds,
  onActivate,
}: {
  topRecommendation: AIRecommendationItem | null;
  createdIds?: Set<string>;
  onActivate?: (id: string, seed: CampaignSeed) => void;
}) {
  const { t } = useTranslation();
  if (!topRecommendation) return null;

  const isCreated = !!topRecommendation.campaignSeed && createdIds?.has(topRecommendation.id);

  return (
    <section className={CARD}>
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-5">
        <span>🚀</span>
        {t("aiDashboard.campaign.title")}
      </h2>

      <div className="rounded-2xl border border-border bg-mist/60 p-5 ring-1 ring-accent/10">
        <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent">
          {topRecommendation.title.toUpperCase()}
        </span>

        <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-ink/50">{t("aiDashboard.campaign.offer")}</p>
            <p className="font-medium">{topRecommendation.reason}</p>
          </div>
          <div>
            <p className="text-ink/50">{t("aiDashboard.campaign.impact")}</p>
            <p className="font-medium text-success">{topRecommendation.expectedImpact}</p>
          </div>
        </div>

        {isCreated ? (
          <div className="mt-4 inline-flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
              ✓ {t("aiDashboard.campaignBuilder.created")}
            </span>
            <span className="text-xs text-ink/50">{t("aiDashboard.campaignBuilder.ready")}</span>
          </div>
        ) : topRecommendation.campaignSeed ? (
          <button
            type="button"
            className="btn-primary mt-4 inline-flex text-sm py-2 px-4"
            onClick={() => onActivate?.(topRecommendation.id, topRecommendation.campaignSeed!)}
          >
            {topRecommendation.ctaLabel}
          </button>
        ) : (
          <Link href={topRecommendation.ctaHref} className="btn-primary mt-4 inline-flex text-sm py-2 px-4">
            {topRecommendation.ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
