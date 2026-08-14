import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isWhatsAppConfigured } from "@/lib/whatsapp/provider";

// Возвращает только статус подключения — сам номер телефона (business
// phone_number_id) не является секретом, но токен доступа не возвращается
// клиенту никогда.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  return NextResponse.json({ connected: isWhatsAppConfigured() });
}
