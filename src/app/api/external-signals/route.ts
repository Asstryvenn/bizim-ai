import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWeather } from "@/lib/services/weather";
import { fetchNextHoliday, DEFAULT_COUNTRY_CODE } from "@/lib/services/holidays";
import { requireFeature } from "@/lib/subscription/serverGuard";

/**
 * Route handler для External Signals: реальная погода (Open-Meteo) + реальные
 * праздники (Nager.Date), запрашиваются server-side. External Signals —
 * платная фича тарифа Growth+ (см. PLAN_DEFINITIONS), поэтому route требует
 * авторизации и активной подписки — раньше эндпоинт был публичным без
 * проверки, что противоречит требованию защищать платные фичи на бэкенде,
 * а не только скрытием кнопок в UI.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const guard = await requireFeature(supabase, user.id, "external_signals");
  if (!guard.ok) return guard.response;

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
