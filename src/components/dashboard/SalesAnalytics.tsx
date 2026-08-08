"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { computeStats, filterRowsByRecentDays, type ComputedStats } from "@/lib/analytics";
import type { ParsedRow } from "@/types";

const CARD = "rounded-2xl border border-border bg-card p-6 shadow-card";
const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function statCell(
  label: string,
  value: number | null,
  prevValue: number | null,
  locale: string,
  suffix = ""
) {
  const delta = pctChange(value, prevValue);
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">
        {value !== null ? `${Math.round(value).toLocaleString(locale)}${suffix}` : "—"}
      </p>
      {delta !== null && (
        <p className={`mt-1 text-xs font-medium ${delta >= 0 ? "text-success" : "text-danger"}`}>
          {delta >= 0 ? "+" : ""}
          {delta}% {suffix === "" ? "" : ""}
        </p>
      )}
    </div>
  );
}

export default function SalesAnalytics({ rows }: { rows: ParsedRow[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  const [period, setPeriod] = useState<Period>(30);

  const { current, previous }: { current: ComputedStats; previous: ComputedStats | null } =
    useMemo(() => {
      if (rows.length === 0) {
        return { current: computeStats([]), previous: null };
      }
      const currentRows = filterRowsByRecentDays(rows, period);
      const doublePeriodRows = filterRowsByRecentDays(rows, period * 2);
      const previousRows = doublePeriodRows.filter((r) => !currentRows.includes(r));
      return {
        current: computeStats(currentRows.length > 0 ? currentRows : rows),
        previous: previousRows.length > 0 ? computeStats(previousRows) : null,
      };
    }, [rows, period]);

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span>📈</span>
          {t("aiDashboard.sales.title")}
        </h2>
        <div className="flex rounded-xl border border-border p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                period === p ? "bg-accent text-accent-foreground" : "text-ink/50 hover:text-ink"
              }`}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink/50">{t("aiDashboard.sales.noData")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCell(t("aiDashboard.sales.revenue"), current.totalRevenue, previous?.totalRevenue ?? null, locale, " ₸")}
          {statCell(t("aiDashboard.sales.orders"), current.rowCount, previous?.rowCount ?? null, locale)}
          {statCell(t("aiDashboard.sales.aov"), current.averageCheck, previous?.averageCheck ?? null, locale, " ₸")}
          {statCell(
            t("aiDashboard.sales.customers"),
            current.totalClients,
            previous?.totalClients ?? null,
            locale
          )}
        </div>
      )}
    </section>
  );
}
