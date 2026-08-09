"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Subscription } from "@/types";
import { getPlanDefinition } from "@/lib/subscription/plans";

const STATUS_STYLES: Record<string, string> = {
  active: "text-success",
  canceled: "text-ink/50",
  past_due: "text-danger",
  inactive: "text-ink/50",
};

export default function SubscriptionStatusCard({
  subscription,
}: {
  subscription: Subscription | null;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  const [canceling, setCanceling] = useState(false);

  const statusKey = subscription?.status ?? "inactive";
  const statusLabel =
    statusKey === "active"
      ? t("subscription.status.active")
      : statusKey === "canceled"
        ? t("subscription.status.canceled")
        : statusKey === "past_due"
          ? t("subscription.status.pastDue")
          : t("subscription.status.notActive");

  const planLabel = subscription ? t(getPlanDefinition(subscription.plan).nameKey) : t("subscription.status.free");

  const handleCancel = async () => {
    if (!confirm(t("subscription.status.cancelConfirm"))) return;
    setCanceling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      toast.success(t("subscription.status.canceled"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    } finally {
      setCanceling(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-ink/50">{t("subscription.status.plan")}</p>
            <p className="font-semibold">{planLabel}</p>
          </div>
          <div>
            <p className="text-ink/50">{t("subscription.status.status")}</p>
            <p className={`font-semibold ${STATUS_STYLES[statusKey]}`}>{statusLabel}</p>
          </div>
          {subscription?.status === "active" && subscription.current_period_end && (
            <div>
              <p className="text-ink/50">{t("subscription.status.renews")}</p>
              <p className="font-semibold">
                {new Date(subscription.current_period_end).toLocaleDateString(locale)}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/pricing" className="btn-secondary text-sm py-2 px-4">
            {t("subscription.status.manage")}
          </Link>
          {subscription?.status === "active" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={canceling}
              className="btn-secondary text-sm py-2 px-4 text-danger"
            >
              {t("subscription.status.cancelButton")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
