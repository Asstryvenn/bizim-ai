// WhatsApp Cloud API provider — строго server-side. Токен и business account
// id никогда не попадают в клиентский код (не NEXT_PUBLIC_*, читаются только
// здесь, в route handler-ах). Если credentials не заданы — явно возвращаем
// "not_configured", а не притворяемся, что сообщение отправлено.

export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  reason?: "not_configured" | "invalid_phone" | "api_error";
  error?: string;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

// Приводит номер к формату E.164 без "+" (то, что ожидает Graph API).
// Не придумывает код страны — если номер слишком короткий/пустой, честно
// возвращает null, чтобы вызывающий код показал "Некорректный номер",
// а не отправил заведомо неверный запрос.
export function normalizePhoneForWhatsApp(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d]/g, "");
  // Казахстан/Россия: местная привычка писать номер с "8" вместо кода
  // страны "7" (8 701 234 56 78 вместо +7 701 234 56 78) — это один и тот
  // же номер, но Meta ожидает E.164, поэтому 8XXXXXXXXXX (11 цифр,
  // начинается с 8) честно приводим к 7XXXXXXXXXX, не угадывая для других стран.
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }
  return digits.length >= 10 ? digits : null;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const to = normalizePhoneForWhatsApp(phone);
  if (!to) {
    return { ok: false, reason: "invalid_phone" };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        reason: "api_error",
        error: data?.error?.message ?? `WhatsApp API вернул статус ${res.status}`,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    if (!messageId) {
      return { ok: false, reason: "api_error", error: "WhatsApp API не вернул id сообщения" };
    }

    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, reason: "api_error", error: err instanceof Error ? err.message : "Сетевая ошибка" };
  }
}
