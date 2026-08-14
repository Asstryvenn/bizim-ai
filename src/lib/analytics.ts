import type { ParsedRow } from "@/types";

/**
 * Все функции здесь считают реальные метрики из импортированных строк.
 * Никаких случайных чисел. Если данных недостаточно для метрики,
 * возвращается null, и вызывающий код обязан показать "Недостаточно данных".
 *
 * ВАЖНО (история бага): раньше "клиенты" и "количество" делили один и тот же
 * список алиасов ("количество" считалось синонимом и для quantity, и для
 * clients) — из-за этого файл с продажами по товарам ("Товар/Количество/
 * Цена/Дата", без отдельной колонки клиентов) ошибочно принимал колонку
 * "Количество" за число клиентов и суммировал дробные значения qty как
 * "totalClients" (отсюда некруглые числа вроде 3196.299999999999). Плюс
 * "выручка" никогда не считалась как quantity × unit_price, если в файле
 * была только цена за единицу, а не готовая сумма — отсюда "Sales: 0 ₸".
 * Теперь quantity/unit_price/revenue/clients — четыре независимых, не
 * пересекающихся набора алиасов, и revenue считается тем способом, для
 * которого реально хватает данных.
 */

const DATE_KEYS = ["date", "дата", "day", "день", "дата продажи", "sold_at"];
const QUANTITY_KEYS = ["quantity", "количество", "кол-во", "qty", "штук", "продано", "sold", "units"];
const UNIT_PRICE_KEYS = ["price", "цена", "цена за единицу", "unit_price", "unit price", "стоимость единицы"];
const REVENUE_KEYS = ["revenue", "выручка", "сумма", "amount", "total", "итог", "стоимость", "total_amount"];
// Строго только реальные счётчики клиентов/посетителей — никаких общих слов
// вроде "количество"/"count", которые в разных файлах означают разное.
const CLIENTS_KEYS = ["clients", "клиенты", "customers", "посетители", "visitors"];

function findKey(row: ParsedRow, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find((k) => k.toLowerCase().trim() === candidate);
    if (found) return found;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Локаль-независимые ключи дней недели (getDay(): 0 = воскресенье).
// Отображаемый текст берётся из i18n (namespace "weekday") в UI-компонентах,
// здесь всегда только стабильный ключ, чтобы не завязывать расчёты на язык.
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Sentinel-значение для даты, которую не удалось прочитать из файла.
// UI-слой (DashboardCharts) переводит его через t("dashboard.charts.unknownDate").
export const UNKNOWN_DATE_LABEL = "__unknown_date__";

export interface ComputedStats {
  rowCount: number;
  totalRevenue: number | null;
  totalClients: number | null;
  averageCheck: number | null;
  bestDay: { label: string; revenue: number } | null;
  worstDay: { label: string; revenue: number } | null;
  revenueByWeekday: { weekday: string; revenue: number }[] | null;
  clientsByWeekday: { weekday: string; clients: number }[] | null;
  hasDateColumn: boolean;
  hasRevenueColumn: boolean;
  hasClientsColumn: boolean;
  // Как именно посчитана выручка — важно честно показать пользователю
  // источник цифры, а не просто вывести число.
  revenueSource: "direct_column" | "quantity_times_price" | null;
}

export function computeStats(rows: ParsedRow[]): ComputedStats {
  const empty: ComputedStats = {
    rowCount: rows.length,
    totalRevenue: null,
    totalClients: null,
    averageCheck: null,
    bestDay: null,
    worstDay: null,
    revenueByWeekday: null,
    clientsByWeekday: null,
    hasDateColumn: false,
    hasRevenueColumn: false,
    hasClientsColumn: false,
    revenueSource: null,
  };

  if (rows.length === 0) return empty;

  const sample = rows[0];
  const dateKey = findKey(sample, DATE_KEYS);
  const revenueKey = findKey(sample, REVENUE_KEYS);
  const quantityKey = findKey(sample, QUANTITY_KEYS);
  const unitPriceKey = findKey(sample, UNIT_PRICE_KEYS);
  const clientsKey = findKey(sample, CLIENTS_KEYS);

  // Приоритет — готовая колонка с суммой (revenueKey). Если её нет, но есть
  // и количество, и цена за единицу — считаем выручку сами, честно помечая
  // источник. Если нет ни того, ни другого — выручка неизвестна, а не 0.
  const revenueSource: ComputedStats["revenueSource"] = revenueKey
    ? "direct_column"
    : quantityKey && unitPriceKey
      ? "quantity_times_price"
      : null;

  empty.hasDateColumn = !!dateKey;
  empty.hasRevenueColumn = revenueSource !== null;
  empty.hasClientsColumn = !!clientsKey;

  const computeRowRevenue = (row: ParsedRow): number | null => {
    if (revenueSource === "direct_column") return toNumber(row[revenueKey!]);
    if (revenueSource === "quantity_times_price") {
      const qty = toNumber(row[quantityKey!]);
      const price = toNumber(row[unitPriceKey!]);
      return qty !== null && price !== null ? qty * price : null;
    }
    return null;
  };

  let totalRevenue = 0;
  let totalClients = 0;
  let revenueCount = 0;
  let clientsCount = 0;

  const byDay: Record<string, { revenue: number; clients: number; label: string }> = {};
  const byWeekday: Record<string, { revenue: number; clients: number }> = {};

  for (const row of rows) {
    const revenue = computeRowRevenue(row);
    const clients = clientsKey ? toNumber(row[clientsKey]) : null;

    if (revenue !== null) {
      totalRevenue += revenue;
      revenueCount++;
    }
    if (clients !== null) {
      totalClients += clients;
      clientsCount++;
    }

    if (dateKey) {
      const rawDate = row[dateKey];
      const parsedDate = rawDate ? new Date(String(rawDate)) : null;
      const label = rawDate ? String(rawDate) : UNKNOWN_DATE_LABEL;

      if (!byDay[label]) byDay[label] = { revenue: 0, clients: 0, label };
      byDay[label].revenue += revenue ?? 0;
      byDay[label].clients += clients ?? 0;

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        const weekday = WEEKDAY_KEYS[parsedDate.getDay()];
        if (!byWeekday[weekday]) byWeekday[weekday] = { revenue: 0, clients: 0 };
        byWeekday[weekday].revenue += revenue ?? 0;
        byWeekday[weekday].clients += clients ?? 0;
      }
    }
  }

  const days = Object.values(byDay);
  const bestDay =
    days.length > 0 && revenueSource !== null
      ? days.reduce((a, b) => (b.revenue > a.revenue ? b : a))
      : null;
  const worstDay =
    days.length > 0 && revenueSource !== null
      ? days.reduce((a, b) => (b.revenue < a.revenue ? b : a))
      : null;

  return {
    rowCount: rows.length,
    totalRevenue: revenueCount > 0 ? totalRevenue : null,
    totalClients: clientsCount > 0 ? totalClients : null,
    averageCheck:
      revenueCount > 0 && clientsCount > 0 && totalClients > 0
        ? totalRevenue / totalClients
        : null,
    bestDay: bestDay ? { label: bestDay.label, revenue: bestDay.revenue } : null,
    worstDay: worstDay ? { label: worstDay.label, revenue: worstDay.revenue } : null,
    revenueByWeekday:
      Object.keys(byWeekday).length > 0 && revenueSource !== null
        ? Object.entries(byWeekday).map(([weekday, v]) => ({ weekday, revenue: v.revenue }))
        : null,
    clientsByWeekday:
      Object.keys(byWeekday).length > 0 && clientsKey
        ? Object.entries(byWeekday).map(([weekday, v]) => ({ weekday, clients: v.clients }))
        : null,
    hasDateColumn: !!dateKey,
    hasRevenueColumn: revenueSource !== null,
    hasClientsColumn: !!clientsKey,
    revenueSource,
  };
}

/**
 * Возвращает только строки, дата которых попадает в последние `days` дней
 * от самой свежей даты, найденной в данных. Используется Sales Analytics
 * для переключателя 7D/30D/90D. Если колонки даты нет — возвращает все
 * строки без изменений (нечего фильтровать).
 */
export function filterRowsByRecentDays(rows: ParsedRow[], days: number): ParsedRow[] {
  if (rows.length === 0) return rows;
  const sample = rows[0];
  const dateKey = findKey(sample, DATE_KEYS);
  if (!dateKey) return rows;

  const parsedDates = rows
    .map((r) => (r[dateKey] ? new Date(String(r[dateKey])) : null))
    .filter((d): d is Date => !!d && !isNaN(d.getTime()));

  if (parsedDates.length === 0) return rows;

  const latest = new Date(Math.max(...parsedDates.map((d) => d.getTime())));
  const cutoff = new Date(latest);
  cutoff.setDate(cutoff.getDate() - days);

  return rows.filter((r) => {
    const raw = r[dateKey];
    if (!raw) return false;
    const d = new Date(String(raw));
    return !isNaN(d.getTime()) && d >= cutoff && d <= latest;
  });
}
