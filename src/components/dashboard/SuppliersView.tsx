"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createSupplier } from "@/lib/supplyChainActions";
import { scoreSuppliers } from "@/lib/supplyChain";
import type { Business, PurchaseOrderWithDetails, Supplier } from "@/types";

interface SuppliersViewProps {
  business: Business;
  initialSuppliers: Supplier[];
  orders: PurchaseOrderWithDetails[];
}

const emptyForm = {
  name: "",
  category: "Поставщики",
  phone: "",
  whatsappPhone: "",
  website: "",
  address: "",
  city: "",
  notes: "",
};

export default function SuppliersView({ business, initialSuppliers, orders }: SuppliersViewProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const scored = useMemo(() => scoreSuppliers(suppliers, orders), [suppliers, orders]);
  const bestId = scored.find((s) => s.totalScore !== null)?.supplier.id;

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
        phone: form.phone.trim() || null,
        whatsapp_phone: form.whatsappPhone.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
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
                  <th className="px-4 py-3 font-medium">Контакты</th>
                  <th className="px-4 py-3 font-medium">Заказов</th>
                  <th className="px-4 py-3 font-medium">Ср. доставка</th>
                  <th className="px-4 py-3 font-medium">Задержки</th>
                  <th className="px-4 py-3 font-medium">Оценка</th>
                </tr>
              </thead>
              <tbody>
                {scored.map(({ supplier, metrics, totalScore }) => (
                  <tr key={supplier.id} className="border-b border-border last:border-0 hover:bg-mist/50">
                    <td className="px-4 py-3 font-medium">
                      {supplier.name}
                      {supplier.id === bestId && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          Лучший вариант
                        </span>
                      )}
                      <p className="text-xs text-ink/40 font-normal mt-0.5">{supplier.category}</p>
                    </td>
                    <td className="px-4 py-3 text-ink/60 text-xs space-y-0.5">
                      {supplier.phone && <p>📞 {supplier.phone}</p>}
                      {supplier.whatsapp_phone && <p>💬 {supplier.whatsapp_phone}</p>}
                      {supplier.website && <p>🌐 {supplier.website}</p>}
                      {supplier.address && <p>📍 {supplier.address}{supplier.city ? `, ${supplier.city}` : ""}</p>}
                      {!supplier.phone && !supplier.website && !supplier.address && (
                        <span className="text-ink/30">Контакты не указаны</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink/60">{metrics.ordersCount}</td>
                    <td className="px-4 py-3 text-ink/60">
                      {metrics.avgDeliveryDays !== null ? `${metrics.avgDeliveryDays.toFixed(1)} дн.` : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink/60">
                      {metrics.delayRate !== null ? `${Math.round(metrics.delayRate * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {totalScore !== null ? (
                        <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                          {totalScore}/100
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink/50"
                          title="Нужно минимум 2 завершённых заказа, чтобы оценить поставщика"
                        >
                          Недостаточно данных
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-ink/40 border-t border-border">
            Оценка = 40% скорость доставки + 60% надёжность — считается из реальной истории ваших заказов
            (минимум 2 завершённых заказа у поставщика).
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

            <p className="text-xs text-ink/50">
              Укажите только то, что реально знаете — скорость доставки и надёжность система посчитает сама
              после нескольких заказов.
            </p>

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

            <div>
              <label className="label">Телефон</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+7 ..."
              />
            </div>

            <div>
              <label className="label">WhatsApp (если отличается от телефона)</label>
              <input
                className="input"
                value={form.whatsappPhone}
                onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
                placeholder="+7 ..."
              />
            </div>

            <div>
              <label className="label">Город</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Сайт</label>
              <input
                className="input"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="label">Адрес</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Заметки</label>
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
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
