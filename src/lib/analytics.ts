import type { ParsedRow } from "@/types";

/**
 * Все функции здесь считают реальные метрики из импортированных строк.
 * Никаких случайных чисел. Если данных недостаточно для метрики,
 * возвращается null, и вызывающий код обязан показать "Недостаточно данных".
 *
 * Ожидаемые (гибкие) названия колонок во входном файле, ищем без учёта
 * регистра среди типичных вариантов:
 *   дата:     date, дата, day
 *   выручка:  revenue, выручка, сумма, amount, total
 *   клиенты:  clients, клиенты, customers, count
 */

const DATE_KEYS = ["date", "дата", "day", "день"];
const REVENUE_KEYS = ["revenue", "выручка", "сумма", "amount", "total", "итог"];
const CLIENTS_KEYS = ["clients", "клиенты", "customers", "count", "количество"];

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
  };

  if (rows.length === 0) return empty;

  const sample = rows[0];
  const dateKey = findKey(sample, DATE_KEYS);
  const revenueKey = findKey(sample, REVENUE_KEYS);
  const clientsKey = findKey(sample, CLIENTS_KEYS);

  empty.hasDateColumn = !!dateKey;
  empty.hasRevenueColumn = !!revenueKey;
  empty.hasClientsColumn = !!clientsKey;

  let totalRevenue = 0;
  let totalClients = 0;
  let revenueCount = 0;
  let clientsCount = 0;

  const byDay: Record<string, { revenue: number; clients: number; label: string }> = {};
  const byWeekday: Record<string, { revenue: number; clients: number }> = {};

  for (const row of rows) {
    const revenue = revenueKey ? toNumber(row[revenueKey]) : null;
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
    days.length > 0
      ? days.reduce((a, b) => (b.revenue > a.revenue ? b : a))
      : null;
  const worstDay =
    days.length > 0
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
      Object.keys(byWeekday).length > 0
        ? Object.entries(byWeekday).map(([weekday, v]) => ({ weekday, revenue: v.revenue }))
        : null,
    clientsByWeekday:
      Object.keys(byWeekday).length > 0
        ? Object.entries(byWeekday).map(([weekday, v]) => ({ weekday, clients: v.clients }))
        : null,
    hasDateColumn: !!dateKey,
    hasRevenueColumn: !!revenueKey,
    hasClientsColumn: !!clientsKey,
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
