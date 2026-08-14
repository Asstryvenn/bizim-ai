"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { buildDemandForecast } from "@/lib/supplyChain";
import type { InventoryItem } from "@/types";

export default function ForecastView({ items }: { items: InventoryItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  const forecast = useMemo(() => (selected ? buildDemandForecast(selected) : null), [selected]);

  const chartData = useMemo(() => {
    if (!forecast) return [];
    return [...forecast.history, ...forecast.forecast].map((p) => ({
      date: p.date.slice(5),
      history: p.isForecast ? null : p.qty,
      forecast: p.isForecast ? p.qty : null,
    }));
  }, [forecast]);

  if (items.length === 0) {
    return (
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-6">📈 Прогноз спроса</h1>
        <div className="rounded-2xl border border-border bg-card shadow-card h-56 flex flex-col items-center justify-center text-ink/40 gap-2">
          <div className="text-5xl">📈</div>
          <p>Добавьте товары на странице «Остатки», чтобы увидеть прогноз</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">📈 Прогноз спроса</h1>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input sm:max-w-xs">
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {selected && forecast && (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-ink/50 text-sm">Ожидаемый расход через 7 дней</p>
              <p className="text-3xl font-bold mt-2 tracking-tight">
                {forecast.expectedUsage7d} {selected.unit}
              </p>
            </div>
            <div className="card">
              <p className="text-ink/50 text-sm">Рекомендуемый заказ</p>
              <p className="text-3xl font-bold mt-2 tracking-tight text-accent">
                {forecast.recommendedOrder} {selected.unit}
              </p>
            </div>
            <div className="card">
              <p className="text-ink/50 text-sm">Сезонный коэффициент</p>
              <p className="text-3xl font-bold mt-2 tracking-tight">{forecast.seasonalCoefficient.toFixed(2)}×</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-1">История продаж (30 дней) и прогноз (7 дней)</h3>
            <p className="text-xs text-ink/40 mb-4">{selected.name}, {selected.unit}/день</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgb(var(--color-ink) / 0.5)" }} />
                  <YAxis tick={{ fontSize: 12, fill: "rgb(var(--color-ink) / 0.5)" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgb(var(--color-card))",
                      border: "1px solid rgb(var(--color-border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine x={chartData[29]?.date} stroke="rgb(var(--color-border))" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="history"
                    stroke="rgb(var(--color-accent))"
                    fill="rgb(var(--color-accent) / 0.15)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    stroke="rgb(var(--color-accent))"
                    strokeDasharray="5 5"
                    fill="rgb(var(--color-accent) / 0.05)"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-2">Как считается прогноз</h3>
            <p className="text-sm text-ink/60 leading-relaxed">
              Прогноз учитывает средний расход «{selected.name}» за последние 30 дней и сезонный коэффициент
              (отношение расхода за последнюю неделю к предыдущим трём). На основе этого рассчитан ожидаемый
              расход на 7 дней вперёд и рекомендуемый объём заказа с учётом минимального остатка.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
