import { NextRequest, NextResponse } from "next/server";
import { fetchWeather } from "@/lib/services/weather";
import { fetchNextHoliday, DEFAULT_COUNTRY_CODE } from "@/lib/services/holidays";

/**
 * Route handler для External Signals: реальная погода (Open-Meteo) + реальные
 * праздники (Nager.Date), запрашиваются server-side. Не требует авторизации —
 * отдаёт только публичные, не персональные данные (город берётся из query,
 * который передаёт уже авторизованный Dashboard). Кэширование делают сами
 * fetch() внутри weather.ts/holidays.ts через `next.revalidate`, поэтому этот
 * route не долбит внешние API на каждый запрос пользователя.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? "";
  const langParam = searchParams.get("lang");
  const lang = langParam === "en" ? "en" : "ru";

  const [weather, holiday] = await Promise.all([
    fetchWeather(city, lang),
    fetchNextHoliday(DEFAULT_COUNTRY_CODE),
  ]);

  return NextResponse.json({ weather, holiday });
}
