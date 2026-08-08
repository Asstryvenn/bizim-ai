"use client";

import { useTranslation } from "react-i18next";
import type { Business } from "@/types";
import type { ComputedStats } from "@/lib/analytics";

const CARD = "rounded-2xl border border-border bg-card p-6 shadow-card";

// Customer Insights использует ТОЛЬКО реально существующие поля профиля
// бизнеса (clients_today/week/month/year, average_check) — это реальные
// колонки в Supabase, а не demo. Разбивку "новые/постоянные клиенты" мы
// не считаем, т.к. в проекте нет источника данных для неё — честно
// показываем, что этой метрики пока нет, вместо того чтобы придумывать число.
export default function CustomerInsights({
  business,
  stats,
}: {
  business: Business;
  stats: ComputedStats;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";

  const avgValue = stats.averageCheck ?? (business.average_check || null);

  const metrics = [
    { key: "today", label: t("aiDashboard.customers.today"), value: business.clients_today },
    { key: "week", label: t("aiDashboard.customers.week"), value: business.clients_week },
    { key: "month", label: t("aiDashboard.customers.month"), value: business.clients_month },
    { key: "year", label: t("aiDashboard.customers.year"), value: business.clients_year },
  ];

  const weeklyAvgFromMonth = business.clients_month ? business.clients_month / 4 : null;
  const trendPct =
    weeklyAvgFromMonth && weeklyAvgFromMonth > 0
      ? Math.round(((business.clients_week - weeklyAvgFromMonth) / weeklyAvgFromMonth) * 100)
      : null;

  return (
    <section className={CARD}>
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-5">
        <span>👥</span>
        {t("aiDashboard.customers.title")}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.key} className="rounded-xl border border-border p-4">
            <p className="text-xs text-ink/50">{m.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{m.value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-ink/50">{t("aiDashboard.customers.avgValue")}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {avgValue !== null ? `${Math.round(avgValue).toLocaleString(locale)} ₸` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-ink/50">{t("aiDashboard.customers.activity")}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {trendPct !== null ? (
              <span className={trendPct >= 0 ? "text-success" : "text-danger"}>
                {trendPct >= 0 ? "+" : ""}
                {trendPct}%
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink/60">
        {trendPct !== null
          ? trendPct >= 0
            ? t("aiDashboard.customers.insightUp")
            : t("aiDashboard.customers.insightDown")
          : t("aiDashboard.customers.insightNoData")}
      </p>
    </section>
  );
}
