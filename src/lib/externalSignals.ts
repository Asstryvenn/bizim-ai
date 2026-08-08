/**
 * External Signals — погода/события/праздники/тренды вокруг бизнеса.
 *
 * Погода и праздники теперь реальные (см. src/lib/services/weather.ts,
 * src/lib/services/holidays.ts, вызываются через /api/external-signals —
 * серверный route handler, ключи API не нужны). Локальные события и тренды
 * категории по-прежнему demo-fallback уровня UI — для них в проекте нет
 * подключённого источника данных, поэтому isReal:false и явный бейдж в UI.
 * Ничего из demo НИКОГДА не пишется в Supabase.
 */

export type SignalCategory = "weather" | "events" | "holidays" | "trends";

export interface ExternalSignal {
  id: string;
  category: SignalCategory;
  icon: string;
  title: string;
  impact: string;
  isReal: boolean;
}

/** Demo-часть (Local Events / Category Trends) — источника данных пока нет. */
export function buildDemoSignals(lang: "ru" | "en"): ExternalSignal[] {
  return lang === "ru"
    ? [
        {
          id: "event",
          category: "events",
          icon: "🎉",
          title: "Локальное мероприятие в эти выходные",
          impact: "Потенциальный рост спроса рядом с локацией",
          isReal: false,
        },
        {
          id: "trend",
          category: "trends",
          icon: "🔥",
          title: "Растёт интерес к вашей категории товаров/услуг",
          impact: "Возможность для сезонного продвижения",
          isReal: false,
        },
      ]
    : [
        {
          id: "event",
          category: "events",
          icon: "🎉",
          title: "Local event this weekend",
          impact: "Potential demand increase nearby",
          isReal: false,
        },
        {
          id: "trend",
          category: "trends",
          icon: "🔥",
          title: "Rising interest in your product/service category",
          impact: "An opportunity for seasonal promotion",
          isReal: false,
        },
      ];
}
