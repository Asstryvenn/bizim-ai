"use client";

import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { ComputedStats } from "@/lib/analytics";
import { UNKNOWN_DATE_LABEL } from "@/lib/analytics";

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-56 text-ink/40 text-sm border border-dashed border-border rounded-xl">
      {label}
    </div>
  );
}

export default function DashboardCharts({ stats }: { stats: ComputedStats | null }) {
  const { t } = useTranslation();

  const formatDayLabel = (label: string) =>
    label === UNKNOWN_DATE_LABEL ? t("dashboard.charts.unknownDate") : label;

  if (!stats || stats.rowCount === 0) {
    return (
      <div className="card h-full">
        <h3 className="text-lg font-semibold mb-4">{t("dashboard.charts.dailyTitle")}</h3>
        <EmptyState label={t("dashboard.charts.notEnoughDataImport")} />
      </div>
    );
  }

  const weekdayData = stats.revenueByWeekday?.map((d) => ({
    ...d,
    weekday: t(`weekday.short.${d.weekday}`, d.weekday),
  }));

  return (
    <div className="card h-full flex flex-col space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-1">{t("dashboard.charts.revenueByWeekday")}</h3>
        <p className="text-xs text-ink/40 mb-4">
          {t("dashboard.charts.builtFromRows", { count: stats.rowCount })}
        </p>
        {weekdayData && weekdayData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="weekday" tick={{ fontSize: 12, fill: "rgb(var(--color-ink) / 0.5)" }} />
                <YAxis tick={{ fontSize: 12, fill: "rgb(var(--color-ink) / 0.5)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgb(var(--color-card))",
                    border: "1px solid rgb(var(--color-border))",
                    borderRadius: 12,
                    color: "rgb(var(--color-ink))",
                  }}
                />
                <Bar dataKey="revenue" fill="rgb(var(--color-accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState label={t("dashboard.charts.notEnoughDataColumns")} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border">
        <Metric label={t("dashboard.charts.totalRevenue")} value={stats.totalRevenue} suffix=" ₸" />
        <Metric label={t("dashboard.charts.totalClients")} value={stats.totalClients} />
        <Metric
          label={t("dashboard.charts.averageCheckComputed")}
          value={stats.averageCheck ? Math.round(stats.averageCheck) : null}
          suffix=" ₸"
        />
      </div>

      {stats.bestDay && stats.worstDay && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border text-sm">
          <div>
            <p className="text-ink/40 text-xs uppercase tracking-wide">{t("dashboard.charts.bestDay")}</p>
            <p className="font-semibold mt-1 text-base">
              {formatDayLabel(stats.bestDay.label)} — {Math.round(stats.bestDay.revenue)} ₸
            </p>
          </div>
          <div>
            <p className="text-ink/40 text-xs uppercase tracking-wide">{t("dashboard.charts.worstDay")}</p>
            <p className="font-semibold mt-1 text-base">
              {formatDayLabel(stats.worstDay.label)} — {Math.round(stats.worstDay.revenue)} ₸
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-ink/40 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold mt-1 tracking-tight">
        {value !== null ? `${value}${suffix}` : t("dashboard.charts.notEnoughData")}
      </p>
    </div>
  );
}
