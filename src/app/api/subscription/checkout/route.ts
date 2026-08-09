import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentService } from "@/lib/subscription/paymentService";
import type { PlanId } from "@/types";

const VALID_PLANS: PlanId[] = ["starter", "growth", "pro"];

// POST /api/subscription/checkout { plan } — запускает оформление подписки.
// Сейчас всегда идёт через DemoPaymentService (см. paymentService.ts) —
// подписка активируется мгновенно, БЕЗ реальной оплаты. Когда подключится
// настоящий провайдер, этот же route начнёт возвращать { checkoutUrl } для
// редиректа вместо мгновенной активации — вызывающий код (PaywallModal)
// уже подготовлен на оба варианта ответа.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { plan } = (await request.json()) as { plan?: string };

  if (!plan || !VALID_PLANS.includes(plan as PlanId)) {
    return NextResponse.json({ error: "Некорректный тариф" }, { status: 400 });
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (businessError || !business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }

  try {
    const paymentService = getPaymentService(supabase);
    const result = await paymentService.createCheckoutSession({
      businessId: business.id,
      plan: plan as PlanId,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось оформить подписку" },
      { status: 500 }
    );
  }
}
