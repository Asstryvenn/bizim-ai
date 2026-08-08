"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { AdminDailyPoint } from "@/types";
import i18n from "@/lib/i18n";

type Period = 7 | 30 | 90;
const PERIODS: Period[] = [7, 30, 90];

function formatDay(dateKey: string, period: Period) {
  const d = new Date(dateKey);
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  return period === 7
    ? d.toLocaleDateString(locale, { weekday: "short" })
    : d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
}

function PeriodSwitch({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1 bg-mist rounded-xl p-1">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            value === p ? "bg-accent text-white shadow-sm" : "text-ink/50 hover:text-ink"
          }`}
        >
          {t("admin.charts.daysCount", { count: p })}
        </button>
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-xs shadow-lg">
      <p className="text-ink/50 mb-1">{label}</p>
      <p className="font-semibold">{payload[0].value}</p>
    </div>
  );
}

export function RegistrationsChart({ data }: { data: AdminDailyPoint[] }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>(30);
  const sliced = data.slice(-period).map((d) => ({ ...d, label: formatDay(d.date, period) }));
  const total = sliced.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card animate-fade-in-up">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">📈 {t("admin.charts.registrationsTitle")}</h3>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </div>
      <p className="text-xs text-ink/40 mb-4">{t("admin.charts.newInPeriod", { count: total })}</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sliced}>
            <defs>
              <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-accent))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="rgb(var(--color-accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "rgb(var(--color-muted-foreground))" }}
              interval={period === 90 ? 12 : period === 30 ? 3 : 0}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "rgb(var(--color-muted-foreground))" }} width={28} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="rgb(var(--color-accent))"
              strokeWidth={2}
              fill="url(#regGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AnalysesChart({ data }: { data: AdminDailyPoint[] }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>(30);
  const sliced = data.slice(-period).map((d) => ({ ...d, label: formatDay(d.date, period) }));
  const total = sliced.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card animate-fade-in-up" style={{ animationDelay: "80ms" }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">📄 {t("admin.charts.analysesTitle")}</h3>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </div>
      <p className="text-xs text-ink/40 mb-4">{t("admin.charts.createdInPeriod", { count: total })}</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sliced}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "rgb(var(--color-muted-foreground))" }}
              interval={period === 90 ? 12 : period === 30 ? 3 : 0}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "rgb(var(--color-muted-foreground))" }} width={28} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(var(--color-mist))" }} />
            <Bar dataKey="count" fill="rgb(var(--color-accent))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AdminCharts({
  registrationsSeries,
  analysesSeries,
}: {
  registrationsSeries: AdminDailyPoint[];
  analysesSeries: AdminDailyPoint[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RegistrationsChart data={registrationsSeries} />
      <AnalysesChart data={analysesSeries} />
    </div>
  );
}
