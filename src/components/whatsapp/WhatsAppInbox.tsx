"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { WhatsAppConversation, WhatsAppMessage } from "@/types";

const POLL_INTERVAL_MS = 5000;

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "сейчас";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "вчера";
  if (diffD < 7) return `${diffD} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function statusLabel(status: WhatsAppMessage["status"]): string {
  switch (status) {
    case "sent":
      return "Отправлено";
    case "delivered":
      return "Доставлено";
    case "read":
      return "Прочитано";
    case "failed":
      return "Ошибка";
    default:
      return "";
  }
}

function messageTypeLabel(type: WhatsAppMessage["message_type"]): string {
  switch (type) {
    case "image":
      return "📷 Изображение";
    case "audio":
      return "🎤 Аудио";
    case "document":
      return "📄 Документ";
    case "video":
      return "🎥 Видео";
    case "sticker":
      return "🩹 Стикер";
    case "location":
      return "📍 Геопозиция";
    case "contacts":
      return "👤 Контакт";
    default:
      return "Сообщение";
  }
}

export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const loadConversations = async () => {
    try {
      const res = await fetch("/api/whatsapp/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // тихо игнорируем — следующий poll попробует снова
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/whatsapp/conversations/${conversationId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)));
    } catch {
      // молча — polling подхватит
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(() => {
      loadConversations();
      if (activeIdRef.current) loadMessages(activeIdRef.current);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectConversation = (id: string) => {
    setActiveId(id);
    loadMessages(id);
  };

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, message: text }),
      });
      const data = await res.json();
      if (!res.ok || data.sent === false) {
        toast.error(data.error ?? "Не удалось отправить сообщение");
        setDraft(text);
        return;
      }
      await loadMessages(activeId);
      await loadConversations();
    } catch {
      toast.error("Сетевая ошибка при отправке сообщения");
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleStartNewChat = async () => {
    const phone = newPhone.trim();
    const message = newMessage.trim();
    if (!phone || !message || creatingChat) return;
    setCreatingChat(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, contactName: newName.trim() || undefined, message }),
      });
      const data = await res.json();
      if (!res.ok || data.sent === false) {
        toast.error(data.error ?? "Не удалось отправить сообщение");
        return;
      }
      setNewChatOpen(false);
      setNewPhone("");
      setNewName("");
      setNewMessage("");
      await loadConversations();
      if (data.conversationId) selectConversation(data.conversationId);
    } catch {
      toast.error("Сетевая ошибка при отправке сообщения");
    } finally {
      setCreatingChat(false);
    }
  };

  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (c.contact_name ?? "").toLowerCase().includes(q) || c.customer_phone.includes(q);
  });

  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-border bg-card">
      {/* Список диалогов */}
      <div className="flex w-[320px] shrink-0 flex-col border-r border-border">
        <div className="border-b border-border p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или номеру"
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-accent transition"
            />
            <button
              type="button"
              onClick={() => setNewChatOpen((v) => !v)}
              title="Новый диалог"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90"
            >
              +
            </button>
          </div>
          {newChatOpen && (
            <div className="space-y-2 rounded-xl bg-mist p-3">
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Номер телефона (+7...)"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-accent transition"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Имя (необязательно)"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-accent transition"
              />
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Первое сообщение"
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-accent transition"
              />
              <button
                type="button"
                onClick={handleStartNewChat}
                disabled={!newPhone.trim() || !newMessage.trim() || creatingChat}
                className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {creatingChat ? "Отправка..." : "Начать диалог"}
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <p className="p-4 text-sm text-ink/40">Загрузка диалогов...</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-ink/40">
              {conversations.length === 0
                ? "Пока нет входящих сообщений в WhatsApp."
                : "Ничего не найдено."}
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectConversation(c.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition hover:bg-mist ${
                  activeId === c.id ? "bg-mist" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {c.contact_name || c.customer_phone}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink/40">{formatRelativeTime(c.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-ink/50">{c.last_message_preview || "Нет сообщений"}</span>
                  {c.unread_count > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-medium text-white">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Активный диалог */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!activeConversation ? (
          <div className="flex flex-1 items-center justify-center text-sm text-ink/40">
            Выберите диалог слева, чтобы посмотреть переписку
          </div>
        ) : (
          <>
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-ink">
                {activeConversation.contact_name || activeConversation.customer_phone}
              </p>
              {activeConversation.contact_name && (
                <p className="text-xs text-ink/40">{activeConversation.customer_phone}</p>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingMessages && messages.length === 0 ? (
                <p className="text-sm text-ink/40">Загрузка сообщений...</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                        m.direction === "outbound" ? "bg-accent text-white" : "bg-mist text-ink"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {m.message_type === "text" ? m.content : messageTypeLabel(m.message_type)}
                      </p>
                      <div
                        className={`mt-1 flex items-center gap-1.5 text-[10px] ${
                          m.direction === "outbound" ? "text-white/70" : "text-ink/40"
                        }`}
                      >
                        <span>
                          {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {m.direction === "outbound" && <span>· {statusLabel(m.status)}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-border p-3">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Написать сообщение..."
                className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-accent transition"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Отправить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
