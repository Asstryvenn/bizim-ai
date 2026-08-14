import type { Business, PurchaseOrderWithDetails } from "@/types";

// Собирает текст сообщения поставщику ТОЛЬКО из реальных данных заказа —
// ни цена, ни количество не выдумываются. Если сумма неизвестна, честно не
// упоминается вовсе (не "уточняется" — это выглядело бы как факт).
export function buildOrderWhatsAppMessage(business: Business, order: PurchaseOrderWithDetails): string {
  const lines: string[] = [];
  lines.push("Здравствуйте!");
  lines.push(`Хотим заказать в ${business.business_name}${business.city ? `, ${business.city}` : ""}:`);
  lines.push("");

  for (const item of order.items) {
    const name = item.item?.name ?? "товар";
    const unit = item.item?.unit ?? "";
    lines.push(`— ${name}: ${item.quantity} ${unit}`.trim());
  }

  lines.push("");
  if (order.total_amount !== null) {
    lines.push(`Ожидаемая сумма: ₸${Math.round(order.total_amount).toLocaleString("ru-RU")}`);
  }
  lines.push("Подскажите, пожалуйста, наличие и срок доставки.");
  lines.push("");
  lines.push("Спасибо!");
  lines.push(business.business_name);
  if (business.phone) lines.push(business.phone);

  return lines.join("\n");
}
