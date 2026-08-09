import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Business, Subscription } from "@/types";
import { hasFeature, type FeatureKey } from "@/lib/subscription/features";
import { getPaymentService } from "@/lib/subscription/paymentService";

/**
 * Серверная защита платных фич — используется в API routes (analyze,
 * tools/generate, external-signals, chat), а не только UI-скрытие кнопок.
 * Ищет business пользователя, читает его подписку и проверяет hasFeature().
 * При отказе возвращает готовый NextResponse (402 Payment Required) —
 * вызывающему route достаточно сделать `if (guard.response) return guard.response;`.
 */
export async function requireFeature(
  supabase: SupabaseClient,
  userId: string,
  feature: FeatureKey
): Promise<
  | { ok: true; business: Business; subscription: Subscription }
  | { ok: false; response: NextResponse }
> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (businessError || !business) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Бизнес не найден" }, { status: 404 }),
    };
  }

  const paymentService = getPaymentService(supabase);
  const subscription = await paymentService.getSubscription(business.id);

  if (!hasFeature(subscription, feature)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Эта функция недоступна на вашем текущем тарифе",
          code: "SUBSCRIPTION_REQUIRED",
          feature,
        },
        { status: 402 }
      ),
    };
  }

  return { ok: true, business: business as Business, subscription: subscription as Subscription };
}
