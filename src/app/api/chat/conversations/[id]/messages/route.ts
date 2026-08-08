import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  // Диалог должен принадлежать пользователю — иначе можно было бы чистить
  // чужие сообщения, просто зная id диалога.
  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  const fromMessageId = request.nextUrl.searchParams.get("fromMessageId");

  if (fromMessageId) {
    // Редактирование сообщения: нужно удалить это сообщение и всё, что было
    // отправлено ПОСЛЕ него (как в ChatGPT — редактирование обрезает историю).
    const { data: fromMessage, error: fromError } = await supabase
      .from("chat_messages")
      .select("created_at")
      .eq("id", fromMessageId)
      .eq("conversation_id", id)
      .single();

    if (fromError || !fromMessage) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }

    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("conversation_id", id)
      .gte("created_at", fromMessage.created_at);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Clear chat — полностью очищаем диалог, но саму запись диалога оставляем.
    const { error } = await supabase.from("chat_messages").delete().eq("conversation_id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ cleared: true });
}
