import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import MarkdownMessage from "@/components/chat/MarkdownMessage";
import { UserAvatar, AiAvatar } from "@/components/chat/ChatAvatar";
import {
  SharePublicBadge,
  SharePageSubtitle,
  ShareEmptyState,
  ShareFooterCta,
} from "@/components/chat/SharePageChrome";
import type { ChatMessage } from "@/types";

export const dynamic = "force-dynamic";

export default async function SharedConversationPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const supabase = createServiceRoleClient();

  // Публичная страница читает данные через Service Role (не через RLS от
  // имени посетителя — у него нет сессии), поэтому доступ строго ограничен
  // тут, в коде: только shared = true и точное совпадение share_id.
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id, title, created_at, shared, business_id, businesses(business_name)")
    .eq("share_id", shareId)
    .eq("shared", true)
    .single();

  if (!conversation) {
    notFound();
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  const businessName =
    (conversation as { businesses?: { business_name?: string } | null }).businesses
      ?.business_name ?? "Bizim";

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-border bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
            Bizim
          </Link>
          <SharePublicBadge />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold text-ink">{conversation.title}</h1>
        <SharePageSubtitle businessName={businessName} />

        <div className="mt-6 space-y-5">
          {((messages ?? []) as ChatMessage[]).map((m) => {
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex w-full gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                {isUser ? <UserAvatar name={businessName} /> : <AiAvatar />}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isUser ? "rounded-br-md bg-accent text-white" : "rounded-bl-md bg-card text-ink"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  ) : (
                    <MarkdownMessage content={m.content} />
                  )}
                </div>
              </div>
            );
          })}

          {(!messages || messages.length === 0) && <ShareEmptyState />}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-5 text-center">
          <ShareFooterCta />
        </div>
      </div>
    </main>
  );
}
