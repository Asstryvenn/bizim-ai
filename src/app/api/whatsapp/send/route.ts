import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isWhatsAppConfigured, normalizePhoneForWhatsApp, sendWhatsAppMessage } from "@/lib/whatsapp/provider";
import type { Business } from "@/types";

interface SendBody {
  conversationId?: string;
  phone?: string;
  contactName?: string;
  message?: string;
}

// Отправляет ответ клиенту через WhatsApp Cloud API из инбокса и сохраняет
// исходящее сообщение в Supabase. Принимает либо conversationId
// (существующий диалог), либо phone (новый диалог) — но не доверяет
// businessId из тела запроса, только из сессии пользователя.
export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => ({}))) as SendBody;
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 422 });
  }

  let conversationId = body.conversationId ?? null;
  let customerPhone: string | null = null;

  if (conversationId) {
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("id, customer_phone")
      .eq("id", conversationId)
      .eq("business_id", typedBusiness.id) // жёсткая привязка к своему бизнесу
      .single();
    if (!conversation) {
      return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
    }
    customerPhone = conversation.customer_phone as string;
  } else {
    const normalized = normalizePhoneForWhatsApp(body.phone ?? null);
    if (!normalized) {
      return NextResponse.json({ error: "Некорректный номер телефона" }, { status: 422 });
    }
    customerPhone = normalized;

    const { data: existing } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("business_id", typedBusiness.id)
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (existing) {
      conversationId = existing.id as string;
    } else {
      const { data: created, error: createError } = await supabase
        .from("whatsapp_conversations")
        .insert({
          business_id: typedBusiness.id,
          customer_phone: customerPhone,
          contact_name: body.contactName?.trim() || null,
        })
        .select("id")
        .single();
      if (createError || !created) {
        return NextResponse.json({ error: createError?.message ?? "Не удалось создать диалог" }, { status: 500 });
      }
      conversationId = created.id as string;
    }
  }

  const result = await sendWhatsAppMessage(customerPhone, message);

  if (!result.ok) {
    if (result.reason !== "not_configured") {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        business_id: typedBusiness.id,
        direction: "outbound",
        message_type: "text",
        content: message,
        status: "failed",
        error: result.error ?? result.reason ?? "Неизвестная ошибка",
      });
    }

    return NextResponse.json(
      {
        sent: false,
        configured: isWhatsAppConfigured(),
        error: result.reason === "not_configured" ? "WhatsApp не настроен" : result.error ?? "Не удалось отправить сообщение",
      },
      { status: result.reason === "not_configured" ? 200 : 502 }
    );
  }

  const now = new Date().toISOString();
  const { data: savedMessage, error: insertError } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      business_id: typedBusiness.id,
      wa_message_id: result.messageId,
      direction: "outbound",
      message_type: "text",
      content: message,
      status: "sent",
      created_at: now,
    })
    .select("*")
    .single();

  await supabase
    .from("whatsapp_conversations")
    .update({ last_message_at: now, last_message_preview: message.slice(0, 120) })
    .eq("id", conversationId);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ sent: true, conversationId, message: savedMessage });
}
