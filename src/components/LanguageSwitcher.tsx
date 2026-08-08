"use client";

import { useTranslation } from "react-i18next";
import { useLanguage } from "@/components/LanguageProvider";
import type { Language } from "@/lib/i18n";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
];

// Переключатель RU/EN для верхней панели — стоит рядом с ThemeToggle и UserMenu
// в DashboardNav. Переключение мгновенное (без перезагрузки), язык сохраняется
// в localStorage через LanguageProvider.
export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("languageSwitcher.ariaLabel")}
      className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-0.5 text-xs font-medium"
    >
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={`rounded-lg px-2 py-1 transition ${
            language === code
              ? "bg-accent text-white"
              : "text-ink/50 hover:bg-mist hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
