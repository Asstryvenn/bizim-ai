import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage, isWhatsAppConfigured } from "@/lib/whatsapp/provider";
import { buildOrderWhatsAppMessage } from "@/lib/whatsapp/orderMessage";
import { logActivity } from "@/lib/supplyChainActions";
import type { Business, InventoryItem, PurchaseOrderItem, PurchaseOrderWithDetails, Supplier } from "@/types";

// Отправляет заказ поставщику через WhatsApp Cloud API. Tenant isolation:
// заказ загружается только если он принадлежит бизнесу текущего
// пользователя — id заказа из URL никогда не доверяется напрямую.
// Статус меняется на "реально отправлено" ТОЛЬКО при успешном ответе Meta —
// при ошибке или отсутствии credentials в БД ничего не меняется.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: business } = await supabase.from("businesses").select("*").eq("user_id", user.id).single();
  if (!business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }
  const typedBusiness = business as Business;

  const { data: order } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", orderId)
    .eq("business_id", typedBusiness.id) // жёсткая привязка к своему бизнесу — не доверяем id из URL
    .single();
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const { data: supplier } = await supabase.from("suppliers").select("*").eq("id", order.supplier_id).single();
  if (!supplier) {
    return NextResponse.json({ error: "Поставщик не найден" }, { status: 404 });
  }
  const typedSupplier = supplier as Supplier;

  const { data: orderItems } = await supabase
    .from("purchase_order_items")
    .select("*")
    .eq("order_id", orderId);
  const itemIds = ((orderItems as PurchaseOrderItem[]) ?? []).map((oi) => oi.inventory_item_id);
  const { data: inventoryItems } =
    itemIds.length > 0 ? await supabase.from("inventory_items").select("*").in("id", itemIds) : { data: [] };
  const itemById = new Map(((inventoryItems as InventoryItem[]) ?? []).map((i) => [i.id, i]));

  const orderWithDetails: PurchaseOrderWithDetails = {
    ...order,
    supplier: typedSupplier,
    items: ((orderItems as PurchaseOrderItem[]) ?? []).map((oi) => ({
      ...oi,
      item: itemById.get(oi.inventory_item_id) ?? null,
    })),
  };

  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = body.message?.trim() || buildOrderWhatsAppMessage(typedBusiness, orderWithDetails);

  const contactPhone = typedSupplier.whatsapp_phone || typedSupplier.phone;
  if (!contactPhone) {
    return NextResponse.json(
      { error: "У поставщика не указан номер телефона/WhatsApp", configured: isWhatsAppConfigured() },
      { status: 422 }
    );
  }

  const result = await sendWhatsAppMessage(contactPhone, message);

  if (!result.ok) {
    if (result.reason === "not_configured") {
      // Честный ответ клиенту: не отправлено, но не ошибка пользователя —
      // клиент покажет copy/wa.me fallback вместо "не удалось отправить".
      return NextResponse.json({ sent: false, configured: false, message }, { status: 200 });
    }
    await logActivity(
      supabase,
      typedBusiness.id,
      "whatsapp_send_failed",
      `Не удалось отправить сообщение поставщику «${typedSupplier.name}» через WhatsApp: ${result.error ?? result.reason}`,
      { entityType: "purchase_order", entityId: orderId }
    );
    return NextResponse.json(
      { error: result.error ?? "Не удалось отправить сообщение", configured: true },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  await supabase
    .from("purchase_orders")
    .update({
      external_status: "sent_via_whatsapp",
      whatsapp_message_id: result.messageId,
      sent_at: now,
      status: order.status === "draft" ? "sent" : order.status,
    })
    .eq("id", orderId);

  await logActivity(
    supabase,
    typedBusiness.id,
    "whatsapp_sent",
    `Сообщение поставщику «${typedSupplier.name}» отправлено через WhatsApp`,
    { entityType: "purchase_order", entityId: orderId, metadata: { whatsapp_message_id: result.messageId } }
  );

  return NextResponse.json({ sent: true, configured: true, messageId: result.messageId });
}
