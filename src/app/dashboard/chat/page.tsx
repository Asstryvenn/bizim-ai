import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import ChatApp from "@/components/chat/ChatApp";
import type { Business, ChatConversation, ChatMessage } from "@/types";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!business) {
    redirect("/register");
  }

  const typedBusiness = business as Business;

  const { data: conversationsData } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("business_id", typedBusiness.id)
    .eq("user_id", user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  const conversations = (conversationsData ?? []) as ChatConversation[];
  const initialActiveConversation = conversations[0] ?? null;

  let initialMessages: ChatMessage[] = [];
  if (initialActiveConversation) {
    const { data: messagesData } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", initialActiveConversation.id)
      .order("created_at", { ascending: true });
    initialMessages = (messagesData ?? []) as ChatMessage[];
  }

  const userName = `${typedBusiness.first_name} ${typedBusiness.last_name}`.trim() || typedBusiness.business_name;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <div className="min-h-0 flex-1">
        <ChatApp
          business={typedBusiness}
          userName={userName}
          initialConversations={conversations}
          initialActiveConversation={initialActiveConversation}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
}
