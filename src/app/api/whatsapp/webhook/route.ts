import { NextRequest, NextResponse } from "next/server";

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

// Meta шлёт сюда входящие сообщения/статусы после верификации.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // TODO: обработка входящих сообщений WhatsApp (пока просто подтверждаем приём).
  console.log("WhatsApp webhook event:", JSON.stringify(body));

  return NextResponse.json({ received: true }, { status: 200 });
}
