"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

// Переключатель темы для Header. Тема сохраняется автоматически —
// next-themes пишет выбор в localStorage под ключом "theme".
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // Тема резолвится на клиенте (зависит от localStorage/системы),
  // поэтому до маунта рендерим нейтральную заглушку — избегаем hydration mismatch.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9 rounded-xl border border-border" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? t("theme.enableLight") : t("theme.enableDark")}
      title={isDark ? t("theme.light") : t("theme.dark")}
      className="w-9 h-9 flex items-center justify-center rounded-xl border border-border bg-card text-base transition hover:bg-mist hover:scale-105 active:scale-95"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
