import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseWhatsAppWebhookBody } from "@/lib/whatsapp/webhookPayload";
import { verifyWebhookSignature } from "@/lib/whatsapp/webhookSignature";

// Meta вызывает GET при подключении/проверке webhook в App Dashboard.
// Нужно вернуть hub.challenge как есть (text/plain), иначе верификация не пройдёт.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// У webhook-запроса от Meta нет пользовательской сессии/cookies, поэтому
// пишем через service-role клиент в обход RLS — от имени системы, но со
// строгой привязкой к business_id, определённому по phone_number_id.
async function resolveBusinessId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  phoneNumberId: string
): Promise<string | null> {
  const { data: matched } = await supabase
    .from("businesses")
    .select("id")
    .eq("whatsapp_phone_number_id", phoneNumberId)
    .maybeSingle();
  if (matched) return matched.id as string;

  // Самоисцеление для single-tenant MVP: если это наш единственный
  // настроенный WABA-номер и ни один бизнес ещё не привязан к нему явно,
  // но в базе ровно один бизнес без привязки — привязываем его и
  // запоминаем на будущее. Если бизнесов несколько — не угадываем.
  if (phoneNumberId !== process.env.WHATSAPP_PHONE_NUMBER_ID) return null;

  const { data: unlinked } = await supabase
    .from("businesses")
    .select("id")
    .is("whatsapp_phone_number_id", null);
  if (!unlinked || unlinked.length !== 1) return null;

  const businessId = unlinked[0].id as string;
  await supabase.from("businesses").update({ whatsapp_phone_number_id: phoneNumberId }).eq("id", businessId);
  return businessId;
}

async function getOrCreateConversation(
  supabase: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  customerPhone: string,
  contactName: string | null,
  phoneNumberId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id, contact_name")
    .eq("business_id", businessId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();

  if (existing) {
    // Имя контакта могло появиться позже (первый webhook не всегда несёт profile) — дополняем, не затираем.
    if (contactName && !existing.contact_name) {
      await supabase.from("whatsapp_conversations").update({ contact_name: contactName }).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const { data: created } = await supabase
    .from("whatsapp_conversations")
    .insert({
      business_id: businessId,
      customer_phone: customerPhone,
      contact_name: contactName,
      whatsapp_phone_number_id: phoneNumberId,
    })
    .select("id")
    .single();

  return created!.id as string;
}

// Meta шлёт сюда входящие сообщения и статусы доставки после верификации.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })();

  if (!body) {
    // Невалидный JSON — не наша вина ретраить, но и нечего обрабатывать.
    return NextResponse.json({ received: false }, { status: 200 });
  }

  const { messages, statuses } = parseWhatsAppWebhookBody(body);
  const supabase = createServiceRoleClient();

  for (const msg of messages) {
    try {
      const businessId = await resolveBusinessId(supabase, msg.phoneNumberId);
      if (!businessId) {
        console.warn("WhatsApp webhook: не удалось определить business для phone_number_id");
        continue;
      }

      const conversationId = await getOrCreateConversation(
        supabase,
        businessId,
        msg.from,
        msg.contactName,
        msg.phoneNumberId
      );

      // Дедупликация: уникальный индекс (business_id, wa_message_id) отклонит повтор.
      const { error: insertError } = await supabase.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        business_id: businessId,
        wa_message_id: msg.waMessageId,
        direction: "inbound",
        message_type: msg.messageType,
        content: msg.content,
        media_id: msg.mediaId,
        status: "received",
        created_at: msg.timestamp,
      });

      // Код 23505 = unique_violation — это ожидаемый повтор доставки от Meta, не ошибка.
      if (insertError && insertError.code !== "23505") {
        console.error("WhatsApp webhook: ошибка записи сообщения", insertError.message);
        continue;
      }
      if (insertError?.code === "23505") continue;

      const preview =
        msg.messageType === "text"
          ? (msg.content ?? "").slice(0, 120)
          : `[${msg.messageType}]`;

      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: msg.timestamp,
          last_message_preview: preview,
          unread_count: await incrementUnread(supabase, conversationId),
        })
        .eq("id", conversationId);
    } catch (err) {
      console.error("WhatsApp webhook: не удалось обработать входящее сообщение", err instanceof Error ? err.message : err);
    }
  }

  for (const status of statuses) {
    try {
      const update: Record<string, unknown> = { status: status.status };
      if (status.status === "failed" && status.errorMessage) update.error = status.errorMessage;
      await supabase.from("whatsapp_messages").update(update).eq("wa_message_id", status.waMessageId);
    } catch (err) {
      console.error("WhatsApp webhook: не удалось обновить статус сообщения", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function incrementUnread(supabase: ReturnType<typeof createServiceRoleClient>, conversationId: string) {
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("unread_count")
    .eq("id", conversationId)
    .single();
  return ((data?.unread_count as number | undefined) ?? 0) + 1;
}
