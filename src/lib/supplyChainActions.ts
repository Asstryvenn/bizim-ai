import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryItem, OrderStatus, Supplier } from "@/types";

// Общий хелпер: пишет запись в activity_log для истории действий бизнеса
// (dashboard/account). Ошибки логирования не должны ломать основной сценарий,
// поэтому не бросаем исключение наружу.
export async function logActivity(
  supabase: SupabaseClient,
  businessId: string,
  action: string,
  description: string
) {
  await supabase.from("activity_log").insert({ business_id: businessId, action, description });
}

export interface NewInventoryItemInput {
  business_id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  desired_stock: number;
  avg_daily_usage: number;
  supplier_id: string | null;
}

export async function createInventoryItem(supabase: SupabaseClient, input: NewInventoryItemInput) {
  const { data, error } = await supabase.from("inventory_items").insert(input).select().single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, input.business_id, "item_added", `Добавлен товар «${input.name}»`);
  return data as InventoryItem;
}

export interface NewSupplierInput {
  business_id: string;
  name: string;
  category: string;
  price_index: number;
  avg_delivery_days: number;
  delay_rate: number;
  orders_count: number;
}

export async function createSupplier(supabase: SupabaseClient, input: NewSupplierInput) {
  const { data, error } = await supabase.from("suppliers").insert(input).select().single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, input.business_id, "supplier_added", `Добавлен поставщик «${input.name}»`);
  return data as Supplier;
}

// Автозаказ: создаёт черновик заказа сразу с одной позицией (сам товар,
// требующий пополнения) и статусом "sent" — для MVP этого достаточно, чтобы
// пользователь увидел реальное изменение состояния интерфейса.
export async function createReorderFromItem(
  supabase: SupabaseClient,
  businessId: string,
  item: InventoryItem,
  supplier: Supplier,
  quantity: number
) {
  const unitPrice = supplier.price_index / 10;
  const totalAmount = Math.round(unitPrice * quantity);

  const { data: order, error: orderError } = await supabase
    .from("purchase_orders")
    .insert({
      business_id: businessId,
      supplier_id: supplier.id,
      status: "sent",
      total_amount: totalAmount,
      expected_delivery: new Date(Date.now() + supplier.avg_delivery_days * 86400000)
        .toISOString()
        .slice(0, 10),
    })
    .select()
    .single();

  if (orderError) throw new Error(orderError.message);

  const { error: itemError } = await supabase.from("purchase_order_items").insert({
    order_id: order.id,
    inventory_item_id: item.id,
    quantity,
    unit_price: unitPrice,
  });

  if (itemError) throw new Error(itemError.message);

  await supabase.from("suppliers").update({ orders_count: supplier.orders_count + 1 }).eq("id", supplier.id);

  await logActivity(
    supabase,
    businessId,
    "order_created",
    `Создан автозаказ «${item.name}» (${quantity} ${item.unit}) у поставщика «${supplier.name}»`
  );

  return order;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  draft: "sent",
  sent: "confirmed",
  confirmed: "in_transit",
  in_transit: "delivered",
};

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUS[status] ?? null;
}

export async function advanceOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  businessId: string,
  supplierName: string,
  nextStatus: OrderStatus
) {
  const patch: { status: OrderStatus; actual_delivery?: string } = { status: nextStatus };
  if (nextStatus === "delivered") {
    patch.actual_delivery = new Date().toISOString().slice(0, 10);
  }
  const { error } = await supabase.from("purchase_orders").update(patch).eq("id", orderId);
  if (error) throw new Error(error.message);
  await logActivity(
    supabase,
    businessId,
    "order_status_changed",
    `Заказ у поставщика «${supplierName}» получил статус «${nextStatus}»`
  );
}

export async function toggleToolFavorite(
  supabase: SupabaseClient,
  businessId: string,
  toolKey: string,
  isFavorite: boolean
) {
  const { error } = await supabase
    .from("business_tools")
    .upsert(
      { business_id: businessId, tool_key: toolKey, is_favorite: isFavorite },
      { onConflict: "business_id,tool_key" }
    );
  if (error) throw new Error(error.message);
}

export async function activateTool(supabase: SupabaseClient, businessId: string, toolKey: string, toolTitle: string) {
  const { error } = await supabase
    .from("business_tools")
    .upsert(
      { business_id: businessId, tool_key: toolKey, is_active: true },
      { onConflict: "business_id,tool_key" }
    );
  if (error) throw new Error(error.message);
  await logActivity(supabase, businessId, "tool_activated", `Активирован инструмент «${toolTitle}»`);
}
