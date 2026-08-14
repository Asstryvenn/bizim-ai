"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createSupplier } from "@/lib/supplyChainActions";
import { scoreSuppliers } from "@/lib/supplyChain";
import type { Business, Supplier } from "@/types";

interface SuppliersViewProps {
  business: Business;
  initialSuppliers: Supplier[];
}

const emptyForm = {
  name: "",
  category: "Поставщики",
  price_index: 100,
  avg_delivery_days: 2,
  delay_rate: 0,
};

export default function SuppliersView({ business, initialSuppliers }: SuppliersViewProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const scored = useMemo(() => scoreSuppliers(suppliers), [suppliers]);
  const bestId = scored[0]?.supplier.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Укажите название поставщика");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const created = await createSupplier(supabase, {
        business_id: business.id,
        name: form.name.trim(),
        category: form.category.trim() || "Поставщики",
        price_index: Number(form.price_index) || 100,
        avg_delivery_days: Number(form.avg_delivery_days) || 1,
        delay_rate: Math.min(1, Math.max(0, Number(form.delay_rate) || 0)),
        orders_count: 0,
      });
      setSuppliers((prev) => [created, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success("Поставщик добавлен");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить поставщика");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🚚 База поставщиков</h1>
          <p className="mt-1 text-ink/60 text-sm">{suppliers.length} поставщиков</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary shrink-0">
          + Добавить поставщика
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-card h-56 flex flex-col items-center justify-center text-ink/40 gap-2">
          <div className="text-5xl">🚚</div>
          <p>Пока нет поставщиков — добавьте первого</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink/50">
                  <th className="px-4 py-3 font-medium">Поставщик</th>
                  <th className="px-4 py-3 font-medium">Категория</th>
                  <th className="px-4 py-3 font-medium">Цена (индекс)</th>
                  <th className="px-4 py-3 font-medium">Доставка</th>
                  <th className="px-4 py-3 font-medium">Задержки</th>
                  <th className="px-4 py-3 font-medium">Заказов</th>
                  <th className="px-4 py-3 font-medium">Надёжность</th>
                  <th className="px-4 py-3 font-medium">Оценка</th>
                </tr>
              </thead>
              <tbody>
                {scored.map(({ supplier, reliabilityScore, totalScore }) => (
                  <tr key={supplier.id} className="border-b border-border last:border-0 hover:bg-mist/50">
                    <td className="px-4 py-3 font-medium">
                      {supplier.name}
                      {supplier.id === bestId && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          Лучший вариант
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink/60">{supplier.category}</td>
                    <td className="px-4 py-3 text-ink/60">{supplier.price_index}</td>
                    <td className="px-4 py-3 text-ink/60">{supplier.avg_delivery_days} дн.</td>
                    <td className="px-4 py-3 text-ink/60">{Math.round(supplier.delay_rate * 100)}%</td>
                    <td className="px-4 py-3 text-ink/60">{supplier.orders_count}</td>
                    <td className="px-4 py-3 text-ink/60">{reliabilityScore}%</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                        {totalScore}/100
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-ink/40 border-t border-border">
            Оценка = 35% цена + 25% скорость доставки + 40% надёжность (доля поставок без задержек).
          </p>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-card my-8 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Добавить поставщика</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full h-8 w-8 flex items-center justify-center text-ink/40 hover:bg-mist"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="label">Название</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Категория</label>
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Индекс цены</label>
                <input
                  type="number"
                  className="input"
                  value={form.price_index}
                  onChange={(e) => setForm({ ...form, price_index: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Доставка, дн.</label>
                <input
                  type="number"
                  className="input"
                  value={form.avg_delivery_days}
                  onChange={(e) => setForm({ ...form, avg_delivery_days: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Задержки, 0–1</label>
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  className="input"
                  value={form.delay_rate}
                  onChange={(e) => setForm({ ...form, delay_rate: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Отмена
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Сохранение..." : "Добавить"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
