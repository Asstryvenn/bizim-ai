"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { PlanId } from "@/types";

/**
 * Общий обработчик "выбрать план" для PlanCard/PaywallModal/pricing page.
 * Сейчас POST /api/subscription/checkout всегда идёт через DemoPaymentService
 * и возвращает { mode: "demo" } — подписка активируется сразу. Когда
 * подключится реальный провайдер, route начнёт иногда возвращать
 * { mode: "redirect", checkoutUrl } — этот хук уже готов на оба случая,
 * менять вызывающие компоненты не придётся.
 */
export function useCheckout(onActivated?: () => void) {
  const router = useRouter();
  const { t } = useTranslation();

  return async function chooseplan(plan: PlanId) {
    const res = await fetch("/api/subscription/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });

    let data: { mode?: string; checkoutUrl?: string; error?: string };
    try {
      data = await res.json();
    } catch {
      toast.error(t("subscription.checkout.processing"));
      return;
    }

    if (!res.ok) {
      toast.error(data.error || t("subscription.checkout.processing"));
      return;
    }

    if (data.mode === "redirect" && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    // demo mode — подписка уже активна в БД, просто обновляем страницу
    toast.success(t("subscription.checkout.success"));
    onActivated?.();
    router.refresh();
  };
}
