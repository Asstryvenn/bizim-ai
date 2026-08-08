"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildDemoSignals, type ExternalSignal } from "@/lib/externalSignals";
import { describeWeatherCode, type WeatherOutcome } from "@/lib/services/weather";
import type { HolidayOutcome } from "@/lib/services/holidays";

const CARD = "rounded-2xl border border-border bg-card p-6 shadow-card";

function LiveBadge() {
  const { t } = useTranslation();
  return (
    <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
      {t("aiDashboard.external.liveData")}
    </span>
  );
}

function DemoBadge() {
  const { t } = useTranslation();
  return (
    <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] font-medium text-ink/50">
      {t("aiDashboard.demoBadge")}
    </span>
  );
}

function SignalCard({
  icon,
  title,
  children,
  isReal,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  isReal: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="text-xl leading-none">{icon}</span>
          <h3 className="font-medium text-sm">{title}</h3>
        </div>
        {isReal ? <LiveBadge /> : <DemoBadge />}
      </div>
      <div className="mt-2 text-sm text-ink/60">{children}</div>
    </div>
  );
}

interface SignalsResponse {
  weather: WeatherOutcome;
  holiday: HolidayOutcome;
}

export default function ExternalSignals({ city }: { city: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "ru";
  const locale = lang === "en" ? "en-US" : "ru-RU";

  const [data, setData] = useState<SignalsResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/external-signals?city=${encodeURIComponent(city)}&lang=${lang}`)
      .then((res) => {
        if (!res.ok) throw new Error("request failed");
        return res.json() as Promise<SignalsResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [city, lang]);

  const demoSignals: ExternalSignal[] = buildDemoSignals(lang);

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span>🌍</span>
          {t("aiDashboard.external.title")}
        </h2>
      </div>

      <p className="text-sm text-ink/50 mb-4">{t("aiDashboard.external.subtitle")}</p>

      {loading ? (
        <p className="text-sm text-ink/50">{t("aiDashboard.external.loading")}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* ---------- Weather (real) ---------- */}
          <SignalCard
            icon="🌦"
            title={t("aiDashboard.external.weather.title")}
            isReal={!!(data?.weather && "ok" in data.weather && data.weather.ok)}
          >
            {error || !data ? (
              t("aiDashboard.external.dataUnavailable")
            ) : data.weather.ok ? (
              (() => {
                const w = data.weather;
                const current = describeWeatherCode(w.currentCode, lang);
                const tomorrow = describeWeatherCode(w.tomorrowCode, lang);
                return (
                  <div className="space-y-1">
                    <p>
                      {w.city}
                      {w.country ? `, ${w.country}` : ""} — {t("aiDashboard.external.weather.today")}{" "}
                      {current.icon} {w.currentTempC}°C, {current.text}
                    </p>
                    <p>
                      {t("aiDashboard.external.weather.tomorrow")}: {tomorrow.icon} {w.tomorrowMinC}
                      °…{w.tomorrowMaxC}°C, {tomorrow.text}
                      {w.tomorrowPrecipProbability !== null &&
                        ` · ${t("aiDashboard.external.weather.precipProbability")}: ${w.tomorrowPrecipProbability}%`}
                    </p>
                    {w.tomorrowPrecipProbability !== null && w.tomorrowPrecipProbability >= 40 && (
                      <p className="text-xs text-ink/40">
                        {lang === "ru"
                          ? "Контекстный сигнал для AI — доказанной связи с вашими продажами пока нет."
                          : "Context signal for AI — no proven link to your sales yet."}
                      </p>
                    )}
                  </div>
                );
              })()
            ) : data.weather.reason === "no_city" ? (
              t("aiDashboard.external.noCity")
            ) : (
              t("aiDashboard.external.dataUnavailable")
            )}
          </SignalCard>

          {/* ---------- Holidays (real) ---------- */}
          <SignalCard
            icon="📅"
            title={t("aiDashboard.external.holidays.title")}
            isReal={!!(data?.holiday && "ok" in data.holiday && data.holiday.ok)}
          >
            {error || !data ? (
              t("aiDashboard.external.dataUnavailable")
            ) : data.holiday.ok ? (
              (() => {
                const h = data.holiday;
                const dateLabel = new Date(h.date).toLocaleDateString(locale, {
                  day: "2-digit",
                  month: "long",
                });
                const until =
                  h.daysUntil === 0
                    ? t("aiDashboard.external.holidays.today")
                    : h.daysUntil === 1
                      ? t("aiDashboard.external.holidays.tomorrow")
                      : t("aiDashboard.external.holidays.daysUntil", { count: h.daysUntil });
                return (
                  <p>
                    {h.localName} — {dateLabel} ({until})
                  </p>
                );
              })()
            ) : (
              t("aiDashboard.external.dataUnavailable")
            )}
          </SignalCard>

          {/* ---------- Local Events / Category Trends (demo) ---------- */}
          {demoSignals.map((s) => (
            <SignalCard key={s.id} icon={s.icon} title={s.title} isReal={false}>
              {s.impact}
            </SignalCard>
          ))}
        </div>
      )}
    </section>
  );
}
