"use client";

import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";

// Секции "Язык" и "Тема" на странице настроек — переиспользуют те же
// переключатели, что уже стоят в DashboardNav (LanguageSwitcher, ThemeSwitcher
// поверх next-themes), так что выбор синхронизирован по всему приложению
// и сохраняется автоматически (localStorage), без отдельной кнопки "Сохранить".
export default function PreferencesSettings() {
  const { t } = useTranslation();

  return (
    <>
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-semibold tracking-tight">{t("settings.language.title")}</h2>
            <p className="text-sm text-ink/50 mt-1">{t("settings.language.description")}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-semibold tracking-tight">{t("settings.theme.title")}</h2>
            <p className="text-sm text-ink/50 mt-1">{t("settings.theme.description")}</p>
          </div>
          <ThemeSwitcher />
        </div>
      </div>
    </>
  );
}
