import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryItem, OrderStatus, Supplier } from "@/types";

// Общий хелпер: пишет запись в activity_log для истории действий бизнеса.
// Ошибки логирования не должны ломать основной сценарий, поэтому не
// бросаем исключение наружу. entityType/entityId/metadata — опциональны,
// чтобы не переписывать все существующие вызовы разом.
export async function logActivity(
  supabase: SupabaseClient,
  businessId: string,
  action: string,
  description: string,
  extra?: { entityType?: string; entityId?: string; metadata?: Record<string, unknown> }
) {
  await supabase.from("activity_log").insert({
    business_id: businessId,
    action,
    description,
    entity_type: extra?.entityType ?? null,
    entity_id: extra?.entityId ?? null,
    metadata: extra?.metadata ?? null,
  });
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
  purchase_price: number | null;
  selling_price: number | null;
  supplier_id: string | null;
}

export async function createInventoryItem(supabase: SupabaseClient, input: NewInventoryItemInput) {
  const { data, error } = await supabase.from("inventory_items").insert(input).select().single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, input.business_id, "item_added", `Добавлен товар «${input.name}»`, {
    entityType: "inventory_item",
    entityId: data.id,
  });
  return data as InventoryItem;
}

export interface NewSupplierInput {
  business_id: string;
  name: string;
  category: string;
  phone: string | null;
  whatsapp_phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
}

export async function createSupplier(supabase: SupabaseClient, input: NewSupplierInput) {
  const { data, error } = await supabase.from("suppliers").insert(input).select().single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, input.business_id, "supplier_added", `Добавлен поставщик «${input.name}»`, {
    entityType: "supplier",
    entityId: data.id,
  });
  return data as Supplier;
}

// AI/пользователь обнаружил риск дефицита и предлагает закупку — создаёт
// ТОЛЬКО черновик (status: 'draft'). Ничего не отправляется поставщику
// автоматически: отправка — отдельное явное действие пользователя
// (см. sendOrderViaWhatsApp в lib/whatsapp/orderMessage.ts). Цена и срок
// доставки — только если реально известны, иначе честно NULL.
export async function createOrderDraft(
  supabase: SupabaseClient,
  businessId: string,
  item: InventoryItem,
  supplier: Supplier,
  quantity: number,
  knownAvgDeliveryDays: number | null
) {
  const unitPrice = item.purchase_price;
  const totalAmount = unitPrice !== null ? Math.round(unitPrice * quantity) : null;
  const expectedDelivery =
    knownAvgDeliveryDays !== null
      ? new Date(Date.now() + knownAvgDeliveryDays * 86400000).toISOString().slice(0, 10)
      : null;

  const { data: order, error: orderError } = await supabase
    .from("purchase_orders")
    .insert({
      business_id: businessId,
      supplier_id: supplier.id,
      status: "draft",
      total_amount: totalAmount,
      expected_delivery: expectedDelivery,
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

  await logActivity(
    supabase,
    businessId,
    "order_draft_created",
    `Создан черновик заказа «${item.name}» (${quantity} ${item.unit}) у поставщика «${supplier.name}»`,
    { entityType: "purchase_order", entityId: order.id }
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

// Ручная пометка статуса пользователем — НЕ означает, что событие реально
// произошло у поставщика (для этого есть external_status/sent_at и т.п.,
// проставляемые только реальной WhatsApp-интеграцией). UI обязан подписывать
// эту кнопку как "Отметить вручную", а не как автоматическое действие.
export async function markOrderStatusManually(
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
    "order_status_marked_manually",
    `Пользователь вручную изменил статус заказа у поставщика «${supplierName}» → «${nextStatus}»`,
    { entityType: "purchase_order", entityId: orderId, metadata: { status: nextStatus } }
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
