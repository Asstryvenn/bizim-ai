import { NextResponse } from "next/server";

// POST /api/subscription/webhook — точка входа для БУДУЩЕГО реального
// платёжного провайдера (Kaspi/PayPal/банк). Сейчас провайдера нет, поэтому
// route намеренно не активен и возвращает понятную ошибку, а не притворяется,
// что обработал webhook.
//
// Когда появится провайдер:
//   1. Проверить подпись webhook'а (HMAC/секрет провайдера).
//   2. Распарсить payload -> { businessId | providerSubscriptionId, status, plan, periodEnd }.
//   3. Обновить public.subscriptions через service-role клиент (не anon!) —
//      см. src/lib/subscription/paymentService.ts, добавить
//      `<Provider>PaymentService.handleWebhook()` и звать её отсюда.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Webhook не настроен: реальный платёжный провайдер ещё не подключён. " +
        "См. комментарии в этом файле и в src/lib/subscription/paymentService.ts.",
    },
    { status: 501 }
  );
}
