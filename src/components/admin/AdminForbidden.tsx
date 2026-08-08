"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

// Экран "403" для не-администраторов — вынесен в клиентский компонент,
// чтобы текст переключался вместе с языком интерфейса (страница admin/page.tsx
// остаётся серверным компонентом и не использует хуки).
export default function AdminForbidden() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen bg-mist flex items-center justify-center px-6">
      <div className="card max-w-md text-center">
        <p className="text-sm font-medium text-danger mb-2">403</p>
        <h1 className="text-xl font-semibold">{t("admin.forbidden.title")}</h1>
        <p className="text-sm text-ink/60 mt-2">{t("admin.forbidden.description")}</p>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
          {t("admin.forbidden.back")}
        </Link>
      </div>
    </main>
  );
}
