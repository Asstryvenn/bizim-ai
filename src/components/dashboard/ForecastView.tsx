"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { buildDemandForecast } from "@/lib/supplyChain";
import { computeAbcXyz, type AbcClass, type XyzClass } from "@/lib/salesAnalytics";
import type { InventoryItem, Sale } from "@/types";

const ABC_ORDER: AbcClass[] = ["A", "B", "C"];
const XYZ_ORDER: XyzClass[] = ["X", "Y", "Z"];

export default function ForecastView({ items, sales }: { items: InventoryItem[]; sales: Sale[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  const salesByProduct = useMemo(() => {
    const map = new Map<string, Sale[]>();
    for (const sale of sales) {
      const list = map.get(sale.product_id) ?? [];
      list.push(sale);
      map.set(sale.product_id, list);
    }
    return map;
  }, [sales]);

  const selectedSales = selected ? salesByProduct.get(selected.id) ?? [] : [];
  const forecast = useMemo(
    () => (selected ? buildDemandForecast(selected, selectedSales) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, selectedSales.length]
  );

  const chartData = useMemo(() => {
    if (!forecast || !forecast.hasEnoughData) return [];
    return [...forecast.history, ...forecast.forecast].map((p) => ({
      date: p.date.slice(5),
      history: p.isForecast ? null : p.qty,
      forecast: p.isForecast ? p.qty : null,
    }));
  }, [forecast]);

  const abcXyz = useMemo(
    () => computeAbcXyz(items.map((i) => ({ id: i.id, sales: salesByProduct.get(i.id) ?? [] }))),
    [items, salesByProduct]
  );
  const abcXyzById = new Map(abcXyz.map((e) => [e.productId, e]));
  const matrixCounts: Record<string, number> = {};
  for (const entry of abcXyz) {
    if (entry.abc && entry.xyz) {
      const key = `${entry.abc}-${entry.xyz}`;
      matrixCounts[key] = (matrixCounts[key] ?? 0) + 1;
    }
  }
  const hasAnyClassified = Object.keys(matrixCounts).length > 0;

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

      {selected && forecast && !forecast.hasEnoughData && (
        <div className="rounded-2xl border border-border bg-card shadow-card p-8 text-center">
          <div className="text-4xl mb-3">📉</div>
          <p className="font-medium">Недостаточно данных для точного прогноза «{selected.name}»</p>
          <p className="text-sm text-ink/50 mt-2">
            {forecast.distinctSaleDays === 0
              ? "Нет истории продаж по этому товару."
              : `Есть данные только за ${forecast.distinctSaleDays} дн. — нужно минимум 7 дней с продажами.`}{" "}
            Импортируйте продажи на странице «Остатки».
          </p>
        </div>
      )}

      {selected && forecast && forecast.hasEnoughData && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
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
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-1">История продаж и прогноз на 7 дней</h3>
            <p className="text-xs text-ink/40 mb-4">
              {selected.name}, {selected.unit}/день · {forecast.distinctSaleDays} дней с продажами
            </p>
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
              Прогноз рассчитан из реальной истории продаж «{selected.name}» ({forecast.distinctSaleDays} дней с
              продажами) с учётом тренда последних 7 дней относительно предыдущей недели. Никакие цифры не
              придуманы — если истории меньше 7 дней, прогноз не строится.
            </p>
          </div>
        </>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-1">ABC/XYZ-анализ товаров</h3>
        <p className="text-xs text-ink/40 mb-4">
          ABC — вклад в оборот (по реальным продажам), XYZ — стабильность спроса. Считается только для товаров с
          достаточной историей продаж.
        </p>
        {!hasAnyClassified ? (
          <p className="text-sm text-ink/40">
            Недостаточно данных — импортируйте продажи хотя бы за 2 недели, чтобы увидеть матрицу.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {ABC_ORDER.map((abc) =>
              XYZ_ORDER.map((xyz) => {
                const key = `${abc}-${xyz}`;
                const count = matrixCounts[key] ?? 0;
                const names = items
                  .filter((i) => {
                    const e = abcXyzById.get(i.id);
                    return e?.abc === abc && e?.xyz === xyz;
                  })
                  .map((i) => i.name);
                return (
                  <div key={key} className="rounded-xl border border-border p-3">
                    <p className="text-xs font-semibold text-ink/50">{key}</p>
                    <p className="text-xl font-bold mt-1">{count}</p>
                    {names.length > 0 && (
                      <p className="text-[11px] text-ink/40 mt-1 truncate" title={names.join(", ")}>
                        {names.join(", ")}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
