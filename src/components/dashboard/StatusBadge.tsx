import type { InventoryStatus, OrderStatus } from "@/types";
import { INVENTORY_STATUS_LABEL } from "@/lib/supplyChain";

const INVENTORY_STATUS_CLASSES: Record<InventoryStatus, string> = {
  ok: "bg-success/10 text-success",
  low: "bg-[rgb(234,179,8)]/10 text-[rgb(161,98,7)]",
  critical: "bg-danger/10 text-danger",
  excess: "bg-accent-soft text-accent",
};

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${INVENTORY_STATUS_CLASSES[status]}`}
    >
      {INVENTORY_STATUS_LABEL[status]}
    </span>
  );
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Черновик",
  sent: "Отправлен",
  confirmed: "Подтверждён",
  in_transit: "В пути",
  delivered: "Доставлен",
  delayed: "Задержка",
};

const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  draft: "bg-mist text-ink/60",
  sent: "bg-accent-soft text-accent",
  confirmed: "bg-accent-soft text-accent",
  in_transit: "bg-[rgb(234,179,8)]/10 text-[rgb(161,98,7)]",
  delivered: "bg-success/10 text-success",
  delayed: "bg-danger/10 text-danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ORDER_STATUS_CLASSES[status]}`}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
