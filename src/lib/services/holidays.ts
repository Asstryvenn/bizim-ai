/**
 * Реальные ближайшие праздники — через Nager.Date (date.nager.at).
 * Бесплатный публичный API без обязательного API key, отдаёт официальные
 * праздники по коду страны. В профиле бизнеса сейчас нет отдельного поля
 * страны (только город) — BIZIM ориентирован на казахстанский рынок (см.
 * тексты продукта), поэтому используется фиксированный код страны "KZ" по
 * умолчанию, а не придуманное значение "на глаз". Если у бизнеса появится
 * реальное поле страны, эту константу нужно заменить на него.
 */

export const DEFAULT_COUNTRY_CODE = "KZ";

export interface HolidayResult {
  ok: true;
  name: string;
  localName: string;
  date: string; // YYYY-MM-DD
  daysUntil: number;
}

export type HolidayOutcome = HolidayResult | { ok: false; reason: "unavailable" };

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
}

export async function fetchNextHoliday(countryCode: string = DEFAULT_COUNTRY_CODE): Promise<HolidayOutcome> {
  try {
    const url = `https://date.nager.at/api/v3/NextPublicHolidays/${countryCode}`;
    const res = await fetch(url, {
      // Список праздников меняется раз в год — можно кэшировать надолго.
      next: { revalidate: 43200 },
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };

    const data = (await res.json()) as NagerHoliday[];
    if (!Array.isArray(data) || data.length === 0) return { ok: false, reason: "unavailable" };

    const next = data[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const holidayDate = new Date(next.date);
    const daysUntil = Math.round((holidayDate.getTime() - today.getTime()) / 86400000);

    return {
      ok: true,
      name: next.name,
      localName: next.localName,
      date: next.date,
      daysUntil,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
