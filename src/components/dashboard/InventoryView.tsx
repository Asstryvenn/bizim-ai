"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createInventoryItem, createReorderFromItem } from "@/lib/supplyChainActions";
import {
  daysOfStockLeft,
  getInventoryStatus,
  recommendedOrderQty,
  scoreSuppliers,
} from "@/lib/supplyChain";
import { InventoryStatusBadge } from "@/components/dashboard/StatusBadge";
import type { Business, InventoryItem, InventoryStatus, Supplier } from "@/types";

interface InventoryViewProps {
  business: Business;
  initialItems: InventoryItem[];
  suppliers: Supplier[];
}

const STATUS_FILTERS: { value: InventoryStatus | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "critical", label: "Критический остаток" },
  { value: "low", label: "Скоро закончится" },
  { value: "ok", label: "В норме" },
  { value: "excess", label: "Избыток" },
];

const emptyForm = {
  name: "",
  category: "",
  unit: "шт",
  current_stock: 0,
  min_stock: 0,
  desired_stock: 0,
  avg_daily_usage: 0,
  supplier_id: "",
};

export default function InventoryView({ business, initialItems, suppliers }: InventoryViewProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const bestSupplier = useMemo(() => scoreSuppliers(suppliers)[0]?.supplier ?? null, [suppliers]);

  const filtered = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || getInventoryStatus(item) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Укажите название товара");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const created = await createInventoryItem(supabase, {
        business_id: business.id,
        name: form.name.trim(),
        category: form.category.trim() || "Общее",
        unit: form.unit.trim() || "шт",
        current_stock: Number(form.current_stock) || 0,
        min_stock: Number(form.min_stock) || 0,
        desired_stock: Number(form.desired_stock) || 0,
        avg_daily_usage: Number(form.avg_daily_usage) || 0,
        supplier_id: form.supplier_id || null,
      });
      setItems((prev) => [created, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success("Товар добавлен");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить товар");
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = async (item: InventoryItem) => {
    const supplier = (item.supplier_id && supplierById.get(item.supplier_id)) || bestSupplier;
    if (!supplier) {
      toast.error("Сначала добавьте поставщика на странице «Поставщики»");
      return;
    }
    setReorderingId(item.id);
    try {
      const supabase = createClient();
      const qty = recommendedOrderQty(item);
      await createReorderFromItem(supabase, business.id, item, supplier, qty || item.min_stock || 10);
      toast.success(`Заказ на «${item.name}» сформирован и отправлен поставщику «${supplier.name}»`);
      router.push("/dashboard/orders");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать заказ");
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📦 Учёт остатков</h1>
          <p className="mt-1 text-ink/60 text-sm">
            {items.length} товаров · {items.filter((i) => getInventoryStatus(i) !== "ok").length} требуют внимания
          </p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary shrink-0">
          + Добавить товар
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск товара..."
          className="input sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InventoryStatus | "all")}
          className="input sm:max-w-xs"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-ink/40 gap-2">
            <div className="text-5xl">📦</div>
            <p>{items.length === 0 ? "Пока нет товаров — добавьте первый" : "Ничего не найдено"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink/50">
                  <th className="px-4 py-3 font-medium">Товар</th>
                  <th className="px-4 py-3 font-medium">Категория</th>
                  <th className="px-4 py-3 font-medium">Остаток</th>
                  <th className="px-4 py-3 font-medium">Мин. остаток</th>
                  <th className="px-4 py-3 font-medium">Расход/день</th>
                  <th className="px-4 py-3 font-medium">Хватит на</th>
                  <th className="px-4 py-3 font-medium">Поставщик</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const status = getInventoryStatus(item);
                  const days = daysOfStockLeft(item);
                  const supplier = item.supplier_id ? supplierById.get(item.supplier_id) : null;
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-mist/50">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-ink/60">{item.category}</td>
                      <td className="px-4 py-3">
                        {item.current_stock} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-ink/60">
                        {item.min_stock} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-ink/60">
                        {item.avg_daily_usage} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-ink/60">
                        {days === null ? "—" : `${days < 1 ? "< 1" : days.toFixed(1)} дн.`}
                      </td>
                      <td className="px-4 py-3 text-ink/60">{supplier?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <InventoryStatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(status === "low" || status === "critical") && (
                          <button
                            type="button"
                            onClick={() => handleReorder(item)}
                            disabled={reorderingId === item.id}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            {reorderingId === item.id ? "..." : "Заказать сейчас"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
              <h2 className="text-lg font-semibold tracking-tight">Добавить товар</h2>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Категория</label>
                <input
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Напитки"
                />
              </div>
              <div>
                <label className="label">Единица</label>
                <input
                  className="input"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="л, кг, шт"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Текущий остаток</label>
                <input
                  type="number"
                  className="input"
                  value={form.current_stock}
                  onChange={(e) => setForm({ ...form, current_stock: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Минимальный остаток</label>
                <input
                  type="number"
                  className="input"
                  value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Средний расход/день</label>
                <input
                  type="number"
                  className="input"
                  value={form.avg_daily_usage}
                  onChange={(e) => setForm({ ...form, avg_daily_usage: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Желаемый запас</label>
                <input
                  type="number"
                  className="input"
                  value={form.desired_stock}
                  onChange={(e) => setForm({ ...form, desired_stock: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="label">Поставщик</label>
              <select
                className="input"
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
              >
                <option value="">Не выбран</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
