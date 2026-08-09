import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentService } from "@/lib/subscription/paymentService";

// GET /api/subscription — текущая подписка бизнеса залогиненного пользователя.
// null, если подписки ещё нет (Free / не активирована).
export async function GET() {
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

  const paymentService = getPaymentService(supabase);
  const subscription = await paymentService.getSubscription(business.id);

  return NextResponse.json({ subscription });
}
