import { createHmac, timingSafeEqual } from "crypto";

// Meta подписывает тело webhook-запроса HMAC-SHA256 с App Secret и присылает
// его в заголовке X-Hub-Signature-256 (см. документацию Graph API webhooks).
// Если WHATSAPP_APP_SECRET не задан — пропускаем проверку (честно, без
// притворства: verify_token на GET уже защищает подписку, а не приём
// событий), но если секрет задан, невалидную подпись отклоняем.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true;
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
