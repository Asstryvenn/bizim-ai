// Типы и парсинг входящего WhatsApp Cloud API webhook payload.
// Meta не гарантирует, что все поля присутствуют — парсинг максимально
// защитный, ничего не бросает исключений наружу.

export interface ParsedInboundMessage {
  phoneNumberId: string;
  from: string;
  contactName: string | null;
  waMessageId: string;
  messageType:
    | "text"
    | "image"
    | "audio"
    | "document"
    | "video"
    | "sticker"
    | "location"
    | "contacts"
    | "unknown";
  content: string | null;
  mediaId: string | null;
  timestamp: string;
}

export interface ParsedStatusUpdate {
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  errorMessage: string | null;
}

export interface ParsedWebhookEvent {
  messages: ParsedInboundMessage[];
  statuses: ParsedStatusUpdate[];
}

const KNOWN_MEDIA_TYPES = ["image", "audio", "document", "video", "sticker"] as const;

function toIsoTimestamp(unixSeconds: unknown): string {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

// Достаёт все сообщения/статусы из полного тела webhook (entry[].changes[].value).
// Возвращает пустые массивы, если структура не совпадает с ожидаемой —
// вызывающий код всё равно должен вернуть 200, чтобы Meta не ретраила зря.
export function parseWhatsAppWebhookBody(body: unknown): ParsedWebhookEvent {
  const messages: ParsedInboundMessage[] = [];
  const statuses: ParsedStatusUpdate[] = [];

  if (!body || typeof body !== "object") return { messages, statuses };
  const entries = (body as Record<string, unknown>).entry;
  if (!Array.isArray(entries)) return { messages, statuses };

  for (const entry of entries) {
    const changes = (entry as Record<string, unknown>)?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const phoneNumberId = (value.metadata as Record<string, unknown> | undefined)?.phone_number_id;
      if (typeof phoneNumberId !== "string") continue;

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactNameByWaId = new Map<string, string>();
      for (const c of contacts) {
        const waId = (c as Record<string, unknown>)?.wa_id;
        const name = (c as Record<string, unknown>)?.profile as Record<string, unknown> | undefined;
        if (typeof waId === "string" && typeof name?.name === "string") {
          contactNameByWaId.set(waId, name.name);
        }
      }

      const incomingMessages = Array.isArray(value.messages) ? value.messages : [];
      for (const raw of incomingMessages) {
        const m = raw as Record<string, unknown>;
        const from = typeof m.from === "string" ? m.from : null;
        const waMessageId = typeof m.id === "string" ? m.id : null;
        const type = typeof m.type === "string" ? m.type : "unknown";
        if (!from || !waMessageId) continue;

        let content: string | null = null;
        let mediaId: string | null = null;
        let messageType: ParsedInboundMessage["messageType"] = "unknown";

        if (type === "text") {
          messageType = "text";
          content = ((m.text as Record<string, unknown> | undefined)?.body as string) ?? null;
        } else if ((KNOWN_MEDIA_TYPES as readonly string[]).includes(type)) {
          messageType = type as ParsedInboundMessage["messageType"];
          const media = m[type] as Record<string, unknown> | undefined;
          mediaId = typeof media?.id === "string" ? media.id : null;
          content = typeof media?.caption === "string" ? media.caption : null;
        } else if (type === "location") {
          messageType = "location";
          const loc = m.location as Record<string, unknown> | undefined;
          if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
            content = `${loc.latitude}, ${loc.longitude}`;
          }
        } else if (type === "contacts") {
          messageType = "contacts";
        } else {
          messageType = "unknown";
        }

        messages.push({
          phoneNumberId,
          from,
          contactName: contactNameByWaId.get(from) ?? null,
          waMessageId,
          messageType,
          content,
          mediaId,
          timestamp: toIsoTimestamp(m.timestamp),
        });
      }

      const incomingStatuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const raw of incomingStatuses) {
        const s = raw as Record<string, unknown>;
        const waMessageId = typeof s.id === "string" ? s.id : null;
        const status = typeof s.status === "string" ? s.status : null;
        if (!waMessageId || !status) continue;
        if (!["sent", "delivered", "read", "failed"].includes(status)) continue;

        const errors = Array.isArray(s.errors) ? s.errors : [];
        const firstError = errors[0] as Record<string, unknown> | undefined;
        const errorMessage = typeof firstError?.title === "string" ? firstError.title : null;

        statuses.push({ waMessageId, status: status as ParsedStatusUpdate["status"], errorMessage });
      }
    }
  }

  return { messages, statuses };
}
