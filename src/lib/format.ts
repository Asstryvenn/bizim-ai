// Единый форматтер для чисел, которые показываются пользователю. Раньше
// разные места дашборда выводили сырые числа с плавающей точкой напрямую
// (например "3196.299999999999" при сумме дробных продаж) — здесь всегда
// округляем перед показом и используем локаль ru-RU/en-US по контексту.

export function formatKzt(value: number | null, locale: "ru-RU" | "en-US" = "ru-RU"): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `₸${Math.round(value).toLocaleString(locale)}`;
}

export function formatQuantity(value: number | null, unit: string, locale: "ru-RU" | "en-US" = "ru-RU"): string {
  if (value === null || !Number.isFinite(value)) return "—";
  // Дробные единицы (литры/кг) — один знак после запятой, штучные — целое число.
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString(locale)} ${unit}`;
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}%`;
}

export function formatCount(value: number | null, locale: "ru-RU" | "en-US" = "ru-RU"): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString(locale);
}
