"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import ThemeToggle from "@/components/admin/ThemeToggle";

// Верхняя панель admin-страницы — клиентский компонент ради переводимого текста,
// сама admin/page.tsx остаётся серверным компонентом (загрузка данных не трогается).
export default function AdminHeaderBar() {
  const { t } = useTranslation();
  return (
    <header className="border-b border-border bg-paper sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Bizim
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink/50 hidden sm:inline">{t("admin.panelLabel")}</span>
          <ThemeToggle />
          <Link href="/dashboard" className="btn-secondary text-sm py-2 px-4">
            {t("admin.backToDashboard")}
          </Link>
        </div>
      </div>
    </header>
  );
}
