"use client";

import { useTranslation } from "react-i18next";
import type { Business } from "@/types";
import { BUSINESS_TYPES } from "@/lib/validation";
import i18n from "@/lib/i18n";

function formatDateTime(iso: string | null, neverLabel: string) {
  if (!iso) return neverLabel;
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BusinessCard({ business }: { business: Business }) {
  const { t } = useTranslation();
  const type = BUSINESS_TYPES.find((bt) => bt.value === business.business_type);
  const typeLabel = type ? t(type.labelKey) : business.business_type;
  const neverLabel = t("dashboard.card.never");

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{business.business_name}</h2>
          <p className="text-ink/50 text-sm mt-1">
            {typeLabel} · {business.city}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div>
          <p className="text-xs text-ink/40 uppercase tracking-wide">{t("dashboard.card.employees")}</p>
          <p className="text-lg font-semibold mt-1">{business.employees_count}</p>
        </div>
        <div>
          <p className="text-xs text-ink/40 uppercase tracking-wide">{t("dashboard.card.clientsPerMonth")}</p>
          <p className="text-lg font-semibold mt-1">{business.clients_month}</p>
        </div>
        <div>
          <p className="text-xs text-ink/40 uppercase tracking-wide">{t("dashboard.card.averageCheck")}</p>
          <p className="text-lg font-semibold mt-1">{business.average_check} ₸</p>
        </div>
        <div>
          <p className="text-xs text-ink/40 uppercase tracking-wide">{t("dashboard.card.peakHours")}</p>
          <p className="text-lg font-semibold mt-1">{business.peak_hours || "—"}</p>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm text-ink/50">
        <span>{t("dashboard.card.lastAnalysis")}: {formatDateTime(business.last_analysis_at, neverLabel)}</span>
        <span>{t("dashboard.card.updated")}: {formatDateTime(business.updated_at, neverLabel)}</span>
      </div>
    </div>
  );
}
