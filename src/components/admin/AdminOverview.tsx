"use client";

import { useTranslation } from "react-i18next";
import type { AdminStats, AdminDailyPoint, AdminTopBusiness } from "@/types";
import StatsCard from "./StatsCard";
import AdminCharts from "./AdminCharts";
import i18n from "@/lib/i18n";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminOverview({
  stats,
  registrationsSeries,
  analysesSeries,
  topBusinesses,
}: {
  stats: AdminStats;
  registrationsSeries: AdminDailyPoint[];
  analysesSeries: AdminDailyPoint[];
  topBusinesses: AdminTopBusiness[];
}) {
  const { t } = useTranslation();

  const cards = [
    { icon: "👤", label: t("admin.overview.cards.totalUsers"), value: stats.usersCount },
    { icon: "🏢", label: t("admin.overview.cards.totalBusinesses"), value: stats.businessesCount },
    { icon: "📄", label: t("admin.overview.cards.totalAnalyses"), value: stats.analysesCount },
    { icon: "🚀", label: t("admin.overview.cards.totalGrowthTools"), value: stats.growthToolsCount },
    { icon: "📅", label: t("admin.overview.cards.registeredToday"), value: stats.registeredToday },
    { icon: "📈", label: t("admin.overview.cards.active7d"), value: stats.activeUsers7d },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <StatsCard key={c.label} icon={c.icon} label={c.label} value={c.value} index={i} />
        ))}
      </div>

      <AdminCharts registrationsSeries={registrationsSeries} analysesSeries={analysesSeries} />

      <div className="card animate-fade-in-up overflow-x-auto" style={{ animationDelay: "140ms" }}>
        <h3 className="font-semibold mb-1">🏆 {t("admin.overview.topBusinesses")}</h3>
        <p className="text-xs text-ink/40 mb-4">{t("admin.overview.byAnalysesCount")}</p>
        {topBusinesses.length === 0 ? (
          <p className="text-sm text-ink/40 py-6 text-center">{t("admin.overview.noData")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/40 text-xs uppercase tracking-wide border-b border-border">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">{t("admin.overview.columns.name")}</th>
                <th className="py-2 pr-4">{t("admin.overview.columns.analyses")}</th>
                <th className="py-2 pr-4">Growth Tools</th>
                <th className="py-2 pr-4">{t("admin.overview.columns.lastActivity")}</th>
              </tr>
            </thead>
            <tbody>
              {topBusinesses.map((b, i) => (
                <tr
                  key={b.id}
                  className="border-b border-border last:border-0 hover:bg-mist transition-colors"
                >
                  <td className="py-2 pr-4 text-ink/40">{i + 1}</td>
                  <td className="py-2 pr-4 font-medium">{b.business_name}</td>
                  <td className="py-2 pr-4">{b.analyses_count}</td>
                  <td className="py-2 pr-4">{b.growth_tools_count}</td>
                  <td className="py-2 pr-4 whitespace-nowrap text-ink/60">
                    {formatDate(b.last_activity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
