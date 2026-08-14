import type { SupabaseClient } from "@supabase/supabase-js";
import type { PurchaseOrderWithDetails, Supplier } from "@/types";

// Заказы с привязанным поставщиком (без позиций) — используется везде, где
// нужна реальная история заказов для расчёта метрик поставщика
// (computeSupplierMetrics), но не нужна детализация по товарам.
export async function fetchOrdersWithSuppliers(
  supabase: SupabaseClient,
  businessId: string,
  suppliers: Supplier[]
): Promise<PurchaseOrderWithDetails[]> {
  const { data: ordersData } = await supabase.from("purchase_orders").select("*").eq("business_id", businessId);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  return ((ordersData ?? []) as PurchaseOrderWithDetails[]).map((o) => ({
    ...o,
    supplier: supplierById.get(o.supplier_id) ?? null,
    items: [],
  }));
}
