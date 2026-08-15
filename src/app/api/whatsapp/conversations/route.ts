import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Business, WhatsAppConversation } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: business } = await supabase.from("businesses").select("*").eq("user_id", user.id).single();
  if (!business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }
  const typedBusiness = business as Business;

  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("business_id", typedBusiness.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: (data ?? []) as WhatsAppConversation[] });
}
