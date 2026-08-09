import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId, Subscription } from "@/types";

/**
 * Абстракция платёжного слоя. Реальных банковских/платёжных интеграций
 * (Kaspi/PayPal/карты) пока нет — весь этот файл существует, чтобы
 * подключить их позже БЕЗ переписывания вызывающего кода (API routes,
 * UI). Единственная реализация сейчас — DemoPaymentService (см. ниже),
 * явно помеченная как demo и лёгкая для удаления.
 *
 * Когда появится реальный провайдер:
 *   1. Добавить новый класс `KaspiPaymentService implements PaymentService`.
 *   2. Переключить `getPaymentService()` на него (по env-переменной).
 *   3. Подписка обновляется провайдером через handleWebhook(), а НЕ
 *      вручную из UI — createCheckoutSession() в реальной реализации
 *      возвращает { checkoutUrl } вместо мгновенной активации.
 */
export interface CreateCheckoutParams {
  businessId: string;
  plan: PlanId;
}

export type CreateCheckoutResult =
  | { mode: "demo"; subscription: Subscription }
  | { mode: "redirect"; checkoutUrl: string };

export interface PaymentService {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CreateCheckoutResult>;
  getSubscription(businessId: string): Promise<Subscription | null>;
  cancelSubscription(businessId: string): Promise<Subscription>;
  /** Обработка webhook реального провайдера. Demo-реализация не используется (webhook'а у demo нет). */
  handleWebhook(payload: unknown): Promise<void>;
}

// =====================================================================
// DEMO MODE — можно полностью удалить этот класс + его использование в
// getPaymentService(), когда подключится реальный провайдер. Никакой
// реальной оплаты здесь не происходит: "checkout" мгновенно помечает
// подписку как active, это только для демонстрации/разработки.
// =====================================================================
export class DemoPaymentService implements PaymentService {
  constructor(private supabase: SupabaseClient) {}

  async createCheckoutSession({
    businessId,
    plan,
  }: CreateCheckoutParams): Promise<CreateCheckoutResult> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data, error } = await this.supabase
      .from("subscriptions")
      .upsert(
        {
          business_id: businessId,
          plan,
          status: "active",
          provider: "demo",
          provider_customer_id: null,
          provider_subscription_id: null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          canceled_at: null,
          updated_at: now.toISOString(),
        },
        { onConflict: "business_id" }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { mode: "demo", subscription: data as Subscription };
  }

  async getSubscription(businessId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from("subscriptions")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    // Таблица может ещё не существовать, если миграция 008 не применена —
    // не роняем dashboard, просто считаем что подписки нет (fail-closed).
    if (error) return null;
    return (data as Subscription) ?? null;
  }

  async cancelSubscription(businessId: string): Promise<Subscription> {
    const { data, error } = await this.supabase
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Subscription;
  }

  async handleWebhook(): Promise<void> {
    throw new Error(
      "DemoPaymentService.handleWebhook() не поддерживается — у demo-режима нет реального провайдера, который мог бы прислать webhook."
    );
  }
}

/**
 * Фабрика — единственное место, откуда API routes получают PaymentService.
 * Сейчас всегда возвращает demo. Когда появится реальный провайдер:
 *   const provider = process.env.PAYMENT_PROVIDER; // "kaspi" | "paypal" | ...
 *   if (provider === "kaspi") return new KaspiPaymentService(...);
 */
export function getPaymentService(supabase: SupabaseClient): PaymentService {
  return new DemoPaymentService(supabase);
}
