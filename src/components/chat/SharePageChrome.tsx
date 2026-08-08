"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export function SharePublicBadge() {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-xs font-medium text-ink/50">
      🔒 {t("sharePage.readOnlyBadge")}
    </span>
  );
}

export function SharePageSubtitle({ businessName }: { businessName: string }) {
  const { t } = useTranslation();
  return <p className="mt-1 text-sm text-ink/45">{t("sharePage.subtitle", { businessName })}</p>;
}

export function ShareEmptyState() {
  const { t } = useTranslation();
  return <p className="py-10 text-center text-sm text-ink/40">{t("sharePage.noMessages")}</p>;
}

export function ShareFooterCta() {
  const { t } = useTranslation();
  return (
    <>
      <p className="text-sm text-ink/60">{t("sharePage.footerDescription")}</p>
      <Link href="/register" className="btn-primary mt-3 inline-flex">
        {t("sharePage.footerCta")}
      </Link>
    </>
  );
}
