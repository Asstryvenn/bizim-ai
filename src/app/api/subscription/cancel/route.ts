import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentService } from "@/lib/subscription/paymentService";

// POST /api/subscription/cancel — отменяет текущую подписку.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
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
    const subscription = await paymentService.cancelSubscription(business.id);
    return NextResponse.json({ subscription });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось отменить подписку" },
      { status: 500 }
    );
  }
}
