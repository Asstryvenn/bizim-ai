"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

const THEMES: { code: "light" | "dark"; labelKey: string }[] = [
  { code: "light", labelKey: "theme.light" },
  { code: "dark", labelKey: "theme.dark" },
];

// Переключатель Light/Dark в том же визуальном стиле, что и LanguageSwitcher.
// Использует next-themes напрямую (та же система, что и ThemeToggle в шапке) —
// выбор сохраняется в localStorage самой библиотекой и применяется ко всему приложению.
export default function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // Тема резолвится на клиенте (зависит от localStorage/системы) — до маунта
  // рендерим нейтральную заглушку, чтобы не словить hydration mismatch.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-40 rounded-xl border border-border bg-card" aria-hidden />;
  }

  return (
    <div
      role="group"
      aria-label={t("settings.theme.ariaLabel")}
      className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-0.5 text-xs font-medium"
    >
      {THEMES.map(({ code, labelKey }) => (
        <button
          key={code}
          type="button"
          onClick={() => setTheme(code)}
          aria-pressed={resolvedTheme === code}
          className={`rounded-lg px-3 py-1.5 transition ${
            resolvedTheme === code
              ? "bg-accent text-white"
              : "text-ink/50 hover:bg-mist hover:text-ink"
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
