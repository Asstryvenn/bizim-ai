import type { ToolDefinition } from "@/types";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    key: "inventory",
    title: "Учёт остатков",
    description: "Список товаров с текущим остатком, минимальным порогом и прогнозом «на сколько хватит».",
    category: "Склад",
    href: "/dashboard/inventory",
    icon: "📦",
  },
  {
    key: "autoreorder",
    title: "Автозаказ поставщику",
    description: "Система сама считает, когда и сколько заказывать, и формирует заказ в один клик.",
    category: "Закупки",
    href: "/dashboard/inventory",
    icon: "⚡",
  },
  {
    key: "forecast",
    title: "Прогноз спроса",
    description: "История продаж за 30 дней и прогноз на следующие 7 — с учётом сезонности.",
    category: "Аналитика",
    href: "/dashboard/forecast",
    icon: "📈",
  },
  {
    key: "suppliers",
    title: "База поставщиков",
    description: "Сравнение поставщиков по цене, скорости и надёжности с прозрачной оценкой.",
    category: "Поставщики",
    href: "/dashboard/suppliers",
    icon: "🚚",
  },
  {
    key: "delivery",
    title: "Отслеживание доставок",
    description: "Статусы заказов от отправки до доставки, задержки и ожидаемые даты.",
    category: "Уведомления",
    href: "/dashboard/orders",
    icon: "🔔",
  },
];
