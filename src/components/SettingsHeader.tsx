"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function SettingsHeader() {
  const { t } = useTranslation();
  return (
    <>
      <Link href="/dashboard" className="text-sm text-accent">
        ← {t("settingsPage.back")}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{t("settingsPage.title")}</h1>
        <p className="text-sm text-ink/50 mt-1">{t("settingsPage.subtitle")}</p>
      </div>
    </>
  );
}
