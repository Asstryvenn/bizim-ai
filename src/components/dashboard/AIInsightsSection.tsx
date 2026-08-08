"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type {
  AIInsightsBundle,
  Severity,
  Priority,
  CampaignSeed,
} from "@/lib/aiInsights";

// Общая логика CTA для recommendation/action-center items, которые несут
// campaignSeed: вместо Link на #import-panel открываем Campaign Builder
// (см. DashboardView + CampaignBuilderModal), а после создания кампании
// показываем статус вместо кнопки — единый источник состояния createdIds.
function CampaignCta({
  id,
  ctaLabel,
  ctaHref,
  campaignSeed,
  createdIds,
  onActivate,
  className,
}: {
  id: string;
  ctaLabel: string;
  ctaHref: string;
  campaignSeed?: CampaignSeed;
  createdIds?: Set<string>;
  onActivate?: (id: string, seed: CampaignSeed) => void;
  className: string;
}) {
  const { t } = useTranslation();

  if (campaignSeed) {
    if (createdIds?.has(id)) {
      return (
        <span className="inline-flex flex-col items-start gap-0.5 shrink-0">
          <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
            ✓ {t("aiDashboard.campaignBuilder.created")}
          </span>
          <span className="text-xs text-ink/50">{t("aiDashboard.campaignBuilder.ready")}</span>
        </span>
      );
    }
    return (
      <button
        type="button"
        className={className}
        onClick={() => onActivate?.(id, campaignSeed)}
      >
        {ctaLabel}
      </button>
    );
  }

  return (
    <Link href={ctaHref} className={className}>
      {ctaLabel}
    </Link>
  );
}

// Единая визуальная система для всех AI-блоков дашборда: нейтральные
// card/border токены темы (см. globals.css), один акцентный цвет,
// без больших цветных градиентов — см. запрос на редизайн дашборда.
const CARD = "rounded-2xl border border-border bg-card p-6 shadow-card";

function DemoBadge() {
  const { t } = useTranslation();
  return (
    <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] font-medium text-ink/50">
      {t("aiDashboard.demoBadge")}
    </span>
  );
}

function SectionHeader({
  icon,
  title,
  isDemo,
}: {
  icon: string;
  title: string;
  isDemo: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span>{icon}</span>
        {title}
      </h2>
      {isDemo && <DemoBadge />}
    </div>
  );
}

const severityStyles: Record<Severity, string> = {
  high: "bg-danger/10 text-danger",
  medium: "bg-accent-soft text-accent",
  low: "bg-mist text-ink/60",
};

const priorityStyles: Record<Priority, string> = {
  HIGH: "bg-danger/10 text-danger",
  MEDIUM: "bg-accent-soft text-accent",
  LOW: "bg-mist text-ink/60",
};

// ---------- Business Health Score ----------

export function BusinessHealthScore({ bundle }: { bundle: AIInsightsBundle }) {
  const { t } = useTranslation();
  const { health, isDemo } = bundle;

  return (
    <section className={CARD}>
      <SectionHeader icon="🩺" title={t("aiDashboard.health.title")} isDemo={isDemo} />

      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-5xl font-bold tracking-tight text-accent">{health.score}</span>
          <span className="text-ink/40 text-lg">/ 100</span>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {health.breakdown.map((item) => (
            <div key={item.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-ink/60">{item.label}</span>
                <span className="font-medium">{item.score}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-mist overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm text-ink/60">{health.summary}</p>

      <Link
        href="/dashboard/chat"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
      >
        {t("aiDashboard.health.improve")} →
      </Link>
    </section>
  );
}

// ---------- AI Action Center ----------

export function AIActionCenter({
  bundle,
  createdIds,
  onActivate,
}: {
  bundle: AIInsightsBundle;
  createdIds?: Set<string>;
  onActivate?: (id: string, seed: CampaignSeed) => void;
}) {
  const { t } = useTranslation();
  const { actionCenter, isDemo } = bundle;
  if (actionCenter.length === 0) return null;

  return (
    <section className={CARD}>
      <SectionHeader icon="🎯" title={t("aiDashboard.actionCenter.title")} isDemo={isDemo} />

      <div className="space-y-4">
        {actionCenter.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-border bg-mist/60 p-5 ring-1 ring-accent/10"
          >
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${severityStyles[item.severity]}`}
            >
              {item.title}
            </span>

            <p className="mt-3 text-sm text-ink/80">{item.cause}</p>

            <div className="mt-3 text-sm">
              <span className="text-ink/50">{t("aiDashboard.actionCenter.recommended")}: </span>
              <span className="font-medium">{item.action}</span>
            </div>

            <div className="mt-1 text-sm">
              <span className="text-ink/50">{t("aiDashboard.actionCenter.expected")}: </span>
              <span className="font-medium text-success">{item.expectedImpact}</span>
            </div>

            <CampaignCta
              id={item.id}
              ctaLabel={item.ctaLabel}
              ctaHref={item.ctaHref}
              campaignSeed={item.campaignSeed}
              createdIds={createdIds}
              onActivate={onActivate}
              className="btn-primary mt-4 inline-flex text-sm py-2 px-4"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- AI Insights ----------

export function AIInsights({ bundle }: { bundle: AIInsightsBundle }) {
  const { t } = useTranslation();
  const { insights, isDemo } = bundle;

  return (
    <section className={CARD}>
      <SectionHeader icon="💡" title={t("aiDashboard.insights.title")} isDemo={isDemo} />

      <div className="grid sm:grid-cols-2 gap-4">
        {insights.map((item) => (
          <div key={item.id} className="rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none">{item.icon}</span>
                <h3 className="font-medium text-sm leading-snug">{item.title}</h3>
              </div>
              {item.impact && (
                <span className="shrink-0 text-xs font-semibold text-accent">{item.impact}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-ink/60">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- AI Recommendations ----------

export function AIRecommendations({
  bundle,
  createdIds,
  onActivate,
}: {
  bundle: AIInsightsBundle;
  createdIds?: Set<string>;
  onActivate?: (id: string, seed: CampaignSeed) => void;
}) {
  const { t } = useTranslation();
  const { recommendations, isDemo } = bundle;

  return (
    <section className={CARD}>
      <SectionHeader icon="✅" title={t("aiDashboard.recommendations.title")} isDemo={isDemo} />

      <div className="space-y-3">
        {recommendations.map((item) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border p-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${priorityStyles[item.priority]}`}
                >
                  {item.priority}
                </span>
                <h3 className="font-medium text-sm">{item.title}</h3>
              </div>
              <p className="mt-1 text-sm text-ink/60">{item.reason}</p>
              <p className="mt-1 text-xs text-success font-medium">
                {t("aiDashboard.recommendations.expected")}: {item.expectedImpact}
              </p>
            </div>
            <CampaignCta
              id={item.id}
              ctaLabel={item.ctaLabel}
              ctaHref={item.ctaHref}
              campaignSeed={item.campaignSeed}
              createdIds={createdIds}
              onActivate={onActivate}
              className="btn-secondary text-sm py-2 px-4 shrink-0"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Smart Alerts ----------

export function SmartAlerts({ bundle }: { bundle: AIInsightsBundle }) {
  const { t } = useTranslation();
  const { alerts, isDemo } = bundle;
  if (alerts.length === 0) return null;

  return (
    <section className={CARD}>
      <SectionHeader icon="🔔" title={t("aiDashboard.alerts.title")} isDemo={isDemo} />

      <div className="space-y-3">
        {alerts.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-xl border border-border p-4">
            <span className="text-xl leading-none">{item.icon}</span>
            <div>
              <h3 className="font-medium text-sm">{item.title}</h3>
              <p className="mt-1 text-sm text-ink/60">{item.description}</p>
              <p className="mt-1 text-sm text-accent">{item.action}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
