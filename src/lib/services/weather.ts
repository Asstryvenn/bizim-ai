/**
 * Реальная погода для города бизнеса — через Open-Meteo (open-meteo.com).
 * Выбран специально: бесплатный, без обязательного API key, достаточно
 * геокодинга по названию города + прогноза. Только server-side (route
 * handler), никогда не вызывается напрямую из клиентских компонентов.
 */

export interface WeatherResult {
  ok: true;
  city: string;
  country: string | null;
  currentTempC: number;
  currentCode: number;
  tomorrowMaxC: number;
  tomorrowMinC: number;
  tomorrowCode: number;
  tomorrowPrecipProbability: number | null;
}

export type WeatherOutcome = WeatherResult | { ok: false; reason: "no_city" | "unavailable" };

const WEATHER_DESCRIPTIONS: Record<number, { ru: string; en: string; icon: string }> = {
  0: { ru: "ясно", en: "clear sky", icon: "☀️" },
  1: { ru: "преимущественно ясно", en: "mostly clear", icon: "🌤" },
  2: { ru: "переменная облачность", en: "partly cloudy", icon: "⛅" },
  3: { ru: "пасмурно", en: "overcast", icon: "☁️" },
  45: { ru: "туман", en: "fog", icon: "🌫" },
  48: { ru: "изморозь", en: "depositing rime fog", icon: "🌫" },
  51: { ru: "лёгкая морось", en: "light drizzle", icon: "🌦" },
  53: { ru: "морось", en: "drizzle", icon: "🌦" },
  55: { ru: "сильная морось", en: "dense drizzle", icon: "🌦" },
  61: { ru: "небольшой дождь", en: "slight rain", icon: "🌧" },
  63: { ru: "дождь", en: "rain", icon: "🌧" },
  65: { ru: "сильный дождь", en: "heavy rain", icon: "🌧" },
  66: { ru: "ледяной дождь", en: "freezing rain", icon: "🌧" },
  67: { ru: "сильный ледяной дождь", en: "heavy freezing rain", icon: "🌧" },
  71: { ru: "небольшой снег", en: "slight snow", icon: "🌨" },
  73: { ru: "снег", en: "snow", icon: "🌨" },
  75: { ru: "сильный снегопад", en: "heavy snow", icon: "🌨" },
  77: { ru: "снежная крупа", en: "snow grains", icon: "🌨" },
  80: { ru: "ливень", en: "rain showers", icon: "🌧" },
  81: { ru: "сильный ливень", en: "heavy rain showers", icon: "🌧" },
  82: { ru: "очень сильный ливень", en: "violent rain showers", icon: "⛈" },
  85: { ru: "снежный заряд", en: "snow showers", icon: "🌨" },
  86: { ru: "сильный снежный заряд", en: "heavy snow showers", icon: "🌨" },
  95: { ru: "гроза", en: "thunderstorm", icon: "⛈" },
  96: { ru: "гроза с градом", en: "thunderstorm with hail", icon: "⛈" },
  99: { ru: "сильная гроза с градом", en: "severe thunderstorm with hail", icon: "⛈" },
};

export function describeWeatherCode(code: number, lang: "ru" | "en") {
  const entry = WEATHER_DESCRIPTIONS[code];
  if (!entry) return { text: lang === "ru" ? "неизвестно" : "unknown", icon: "🌡" };
  return { text: entry[lang], icon: entry.icon };
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
  country?: string;
}

async function geocodeCity(city: string, lang: "ru" | "en"): Promise<GeocodeResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=${lang}&format=json`;

  const res = await fetch(url, {
    // Геокодинг города меняется крайне редко — кэшируем на сутки.
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: GeocodeResult[] };
  return data.results?.[0] ?? null;
}

export async function fetchWeather(city: string | null | undefined, lang: "ru" | "en"): Promise<WeatherOutcome> {
  const trimmedCity = (city ?? "").trim();
  if (!trimmedCity) {
    return { ok: false, reason: "no_city" };
  }

  try {
    const geo = await geocodeCity(trimmedCity, lang);
    if (!geo) return { ok: false, reason: "unavailable" };

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
      `&current=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=2`;

    const res = await fetch(forecastUrl, {
      // Погода актуальна около получаса — не дёргаем API на каждый рендер.
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };

    const data = (await res.json()) as {
      current?: { temperature_2m: number; weather_code: number };
      daily?: {
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
      };
    };

    if (!data.current || !data.daily || data.daily.weather_code.length < 2) {
      return { ok: false, reason: "unavailable" };
    }

    return {
      ok: true,
      city: geo.name,
      country: geo.country ?? null,
      currentTempC: Math.round(data.current.temperature_2m),
      currentCode: data.current.weather_code,
      tomorrowMaxC: Math.round(data.daily.temperature_2m_max[1]),
      tomorrowMinC: Math.round(data.daily.temperature_2m_min[1]),
      tomorrowCode: data.daily.weather_code[1],
      tomorrowPrecipProbability: data.daily.precipitation_probability_max?.[1] ?? null,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
