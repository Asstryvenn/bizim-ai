import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
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

  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .select("id, share_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  // share_id переиспользуется, если уже был выдан раньше (даже если сейчас
  // выключен) — так старые разосланные ссылки снова заработают при повторном
  // включении, а не станут "мёртвыми".
  const shareId = conversation.share_id ?? crypto.randomUUID();
 console.log("SHARE ROUTE EXECUTED");
  const { data, error } = await supabase
  .from("chat_conversations")
 
 .update({
  share_id: shareId,
  shared: true,
})
  .eq("id", id)
  .select("share_id")
  .single();

  if (error) {
    console.error(error);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shareId: data.share_id });
}

export async function DELETE(
  _request: NextRequest,
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

 const { error } = await supabase
  .from("chat_conversations")
 .update({
  shared: false,
})
  .eq("id", id)
  .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disabled: true });
}
