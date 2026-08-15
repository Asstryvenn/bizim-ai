import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Business, WhatsAppMessage } from "@/types";

// Отдаёт историю диалога и сбрасывает unread_count — открытие диалога в
// интерфейсе считается прочтением. id диалога из URL не доверяем напрямую:
// жёстко проверяем принадлежность бизнесу текущего пользователя.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
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

  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("business_id", typedBusiness.id)
    .single();
  if (!conversation) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  const { data: messages, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", conversationId);

  return NextResponse.json({ messages: (messages ?? []) as WhatsAppMessage[] });
}
