"use client";

import { useTranslation } from "react-i18next";

export default function BusinessNotFound() {
  const { t } = useTranslation();
  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">{t("dashboard.businessNotFound")}</h1>
    </main>
  );
}
