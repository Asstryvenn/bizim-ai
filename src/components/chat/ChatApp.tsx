"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import type { Business, ChatConversation } from "@/types";
import type { UIMessage, ReactionMap } from "./types";
import { STREAM_ERROR_MARKER, STREAM_META_MARKER, type StreamMeta } from "@/lib/chatStream";
import Sidebar from "./Sidebar";
import Composer from "./Composer";
import WelcomeScreen from "./WelcomeScreen";
import MessageBubble from "./MessageBubble";
import ShareDialog from "./ShareDialog";

const SIDEBAR_KEY = "bizim:chat:sidebarCollapsed";

function sortConversations(list: ChatConversation[]): ChatConversation[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export default function ChatApp({
  business,
  userName,
  initialConversations,
  initialActiveConversation,
  initialMessages,
}: {
  business: Business;
  userName: string;
  initialConversations: ChatConversation[];
  initialActiveConversation: ChatConversation | null;
  initialMessages: UIMessage[];
}) {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<ChatConversation[]>(
    sortConversations(initialConversations)
  );
  const [activeId, setActiveId] = useState<string | null>(initialActiveConversation?.id ?? null);
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<ChatConversation | null>(null);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [offline, setOffline] = useState(false);

  const messageCache = useRef<Map<string, UIMessage[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialActiveConversation) {
      messageCache.current.set(initialActiveConversation.id, initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_KEY) : null;
    if (saved) setCollapsed(saved === "1");
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      toast.success(i18n.t("chat.onlineRestored"));
    };
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      window.localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      return !c;
    });
  };

  const upsertConversation = useCallback((updated: ChatConversation) => {
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== updated.id);
      return sortConversations([updated, ...rest]);
    });
  }, []);

  const selectConversation = useCallback(
    async (id: string) => {
      if (id === activeId) {
        setMobileOpen(false);
        return;
      }
      setActiveId(id);
      setMobileOpen(false);
      const cached = messageCache.current.get(id);
      if (cached) {
        setMessages(cached);
        return;
      }
      setLoadingConversation(true);
      setMessages([]);
      try {
        const res = await fetch(`/api/chat/conversations/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || i18n.t("chat.loadError"));
        const msgs = (data.messages ?? []) as UIMessage[];
        messageCache.current.set(id, msgs);
        setMessages(msgs);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : i18n.t("chat.loadErrorGeneric"));
      } finally {
        setLoadingConversation(false);
      }
    },
    [activeId]
  );

  const createConversation = useCallback(async (): Promise<ChatConversation | null> => {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: business.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || i18n.t("chat.createError"));
      const conv = data.conversation as ChatConversation;
      messageCache.current.set(conv.id, []);
      upsertConversation(conv);
      return conv;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.t("chat.createErrorGeneric"));
      return null;
    }
  }, [business.id, upsertConversation]);

  const handleNewChat = useCallback(async () => {
    if (activeId && messages.length === 0) {
      setMobileOpen(false);
      return;
    }
    const conv = await createConversation();
    if (conv) {
      setActiveId(conv.id);
      setMessages([]);
    }
    setMobileOpen(false);
  }, [activeId, messages.length, createConversation]);

  /**
   * Общий "движок" для стриминга ответа AI — используется и для обычной
   * отправки, и для regenerate, и для continue: разница только в теле
   * запроса и в том, заменяем ли мы содержимое placeholder-сообщения или
   * дописываем к уже существующему (continue).
   */
  const runStream = useCallback(
    async ({
      payload,
      placeholderId,
      initialContent = "",
      conversationId,
    }: {
      payload: Record<string, unknown>;
      placeholderId: string;
      initialContent?: string;
      conversationId: string;
    }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setSending(true);

      let accumulatedRaw = "";

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}) as { error?: string });
          throw new Error(data.error || i18n.t("chat.responseError", { status: res.status }));
        }
        if (!res.body) throw new Error(i18n.t("chat.noStreamResponse"));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulatedRaw += decoder.decode(value, { stream: true });

          const errIdx = accumulatedRaw.indexOf(STREAM_ERROR_MARKER);
          const metaIdx = accumulatedRaw.indexOf(STREAM_META_MARKER);
          const cut = errIdx !== -1 ? errIdx : metaIdx !== -1 ? metaIdx : -1;
          const visible = cut !== -1 ? accumulatedRaw.slice(0, cut) : accumulatedRaw;

          const displayContent = initialContent + visible;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId ? { ...m, content: displayContent, status: "streaming" } : m
            )
          );

          if (cut !== -1) break;
        }

        const errIdx = accumulatedRaw.indexOf(STREAM_ERROR_MARKER);
        const metaIdx = accumulatedRaw.indexOf(STREAM_META_MARKER);

        if (errIdx !== -1) {
          const errText = accumulatedRaw.slice(errIdx + STREAM_ERROR_MARKER.length);
          const partial = accumulatedRaw.slice(0, errIdx);
          if (partial.trim()) {
            const finalContent = initialContent + partial;
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? { ...m, content: finalContent, status: "done" } : m))
            );
            toast.error(i18n.t("chat.interruptedResponse", { reason: errText }));
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
            throw new Error(errText);
          }
        } else if (metaIdx !== -1) {
          const metaJson = accumulatedRaw.slice(metaIdx + STREAM_META_MARKER.length);
          const visible = accumulatedRaw.slice(0, metaIdx);
          const finalContent = initialContent + visible;
          let meta: StreamMeta | null = null;
          try {
            meta = JSON.parse(metaJson) as StreamMeta;
          } catch {
            // если метаданные почему-то битые — просто останемся с временными id
          }

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === placeholderId) {
                return { ...m, id: meta?.modelMessageId || m.id, content: finalContent, status: "done" };
              }
              if (meta?.userMessageId && m.role === "user" && m.id.startsWith("temp-user-")) {
                return { ...m, id: meta.userMessageId };
              }
              return m;
            })
          );

          setConversations((prev) => {
            const found = prev.find((c) => c.id === conversationId);
            if (!found) return prev;
            const updated: ChatConversation = {
              ...found,
              updated_at: new Date().toISOString(),
              title: meta?.title ?? found.title,
            };
            const rest = prev.filter((c) => c.id !== conversationId);
            return sortConversations([updated, ...rest]);
          });
        } else if (!controller.signal.aborted) {
          setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, status: "done" } : m)));
        }

        setMessages((current) => {
          messageCache.current.set(conversationId, current);
          return current;
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => {
            const next = prev.map((m) => (m.id === placeholderId ? { ...m, status: "done" as const } : m));
            messageCache.current.set(conversationId, next);
            return next;
          });
        } else {
          const msg =
            err instanceof Error ? err.message : i18n.t("chat.genericError");
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...m, status: "error", errorText: msg } : m))
          );
        }
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    []
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;

      let conversationId = activeId;
      if (!conversationId) {
        const conv = await createConversation();
        if (!conv) return;
        conversationId = conv.id;
        setActiveId(conversationId);
      }

      const userMsg: UIMessage = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        status: "done",
      };
      const placeholderId = `temp-model-${Date.now()}`;
      const placeholder: UIMessage = {
        id: placeholderId,
        role: "model",
        content: "",
        created_at: new Date().toISOString(),
        status: "pending",
      };

      setMessages((prev) => [...prev, userMsg, placeholder]);

      await runStream({
        payload: { conversationId, message: text, mode: "send" },
        placeholderId,
        conversationId,
      });
    },
    [activeId, sending, createConversation, runStream]
  );

  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!activeId) return;
      let cutIndex = -1;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        cutIndex = idx;
        return idx === -1 ? prev : prev.slice(0, idx);
      });
      if (cutIndex === -1) return;

      if (!messageId.startsWith("temp-")) {
        try {
          await fetch(
            `/api/chat/conversations/${activeId}/messages?fromMessageId=${encodeURIComponent(messageId)}`,
            { method: "DELETE" }
          );
        } catch {
          toast.error(i18n.t("chat.historyUpdateError"));
        }
      }
      await send(newText);
    },
    [activeId, send]
  );

  const regenerate = useCallback(async () => {
    if (!activeId || sending) return;
    let placeholderId = "";
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === "model");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      placeholderId = `temp-model-${Date.now()}`;
      const placeholder: UIMessage = {
        id: placeholderId,
        role: "model",
        content: "",
        created_at: new Date().toISOString(),
        status: "pending",
      };
      return [...prev.slice(0, realIdx), placeholder];
    });
    if (!placeholderId) return;

    await runStream({
      payload: { conversationId: activeId, mode: "regenerate" },
      placeholderId,
      conversationId: activeId,
    });
  }, [activeId, sending, runStream]);

  const continueGeneration = useCallback(async () => {
    if (!activeId || sending) return;
    const lastModel = [...messages].reverse().find((m) => m.role === "model");
    if (!lastModel || lastModel.id.startsWith("temp-")) {
      toast.info(i18n.t("chat.waitSaving"));
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === lastModel.id ? { ...m, status: "streaming" } : m))
    );
    await runStream({
      payload: { conversationId: activeId, mode: "continue", targetMessageId: lastModel.id },
      placeholderId: lastModel.id,
      initialContent: lastModel.content,
      conversationId: activeId,
    });
  }, [activeId, sending, messages, runStream]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryFailedMessage = useCallback(
    (placeholderId: string) => {
      let textToRetry: string | null = null;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === placeholderId);
        if (idx === -1) return prev;
        const preceding = prev[idx - 1];
        const cutFrom = preceding?.role === "user" ? idx - 1 : idx;
        if (preceding?.role === "user") textToRetry = preceding.content;
        return prev.slice(0, cutFrom);
      });
      if (textToRetry) send(textToRetry);
    },
    [send]
  );

  const react = useCallback((messageId: string, reaction: "up" | "down") => {
    setReactions((prev) => {
      const next = { ...prev };
      if (next[messageId] === reaction) delete next[messageId];
      else next[messageId] = reaction;
      return next;
    });
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    setConversations((prev) => sortConversations(prev.map((c) => (c.id === id ? { ...c, title } : c))));
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error(i18n.t("chat.renameError"));
    }
  }, []);

  const togglePin = useCallback(async (id: string, pinned: boolean) => {
    setConversations((prev) => sortConversations(prev.map((c) => (c.id === id ? { ...c, pinned } : c))));
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error(i18n.t("chat.pinError"));
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      const wasActive = id === activeId;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      messageCache.current.delete(id);
      if (wasActive) {
        setActiveId(null);
        setMessages([]);
      }
      try {
        const res = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast.success(i18n.t("chat.deleted"));
      } catch {
        toast.error(i18n.t("chat.deleteError"));
      }
    },
    [activeId]
  );

  const enableShare = useCallback(async (id: string): Promise<string> => {
    const res = await fetch(`/api/chat/conversations/${id}/share`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || i18n.t("chat.genericErrorShort"));
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, shared: true, share_id: data.shareId } : c))
    );
    return data.shareId as string;
  }, []);

  const disableShare = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/conversations/${id}/share`, { method: "DELETE" });
    if (!res.ok) throw new Error(i18n.t("chat.genericErrorShort"));
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, shared: false } : c)));
  }, []);

  const clearChat = useCallback(async () => {
    if (!activeId) return;
    setMessages([]);
    messageCache.current.set(activeId, []);
    try {
      await fetch(`/api/chat/conversations/${activeId}/messages`, { method: "DELETE" });
      toast.success(i18n.t("chat.cleared"));
    } catch {
      toast.error(i18n.t("chat.clearError"));
    }
  }, [activeId]);

  const exportChat = useCallback(() => {
    if (messages.length === 0) {
      toast.info(i18n.t("chat.emptyExport"));
      return;
    }
    const conv = conversations.find((c) => c.id === activeId);
    const lines = messages.map(
      (m) => `**${m.role === "user" ? userName || i18n.t("chat.you") : "Bizim AI"}** (${new Date(m.created_at).toLocaleString(i18n.language)}):\n${m.content}\n`
    );
    const blob = new Blob([lines.join("\n---\n\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(conv?.title || "chat").replace(/[^\p{L}\p{N}-]+/gu, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, conversations, activeId, userName]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const lastModelIndex = [...messages].map((m) => m.role).lastIndexOf("model");
  const lastUserIndex = [...messages].map((m) => m.role).lastIndexOf("user");

  return (
    <div className="flex h-full w-full overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-40 h-full transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          collapsed={collapsed}
          loading={false}
          onToggleCollapse={toggleCollapsed}
          onSelect={selectConversation}
          onNewChat={handleNewChat}
          onRename={renameConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
          onShare={setShareTarget}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-paper/70 px-3 py-2.5 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/60 hover:bg-mist md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <h2 className="truncate text-sm font-semibold text-ink">
              {activeConversation?.title ?? t("chat.newChatTitle")}
            </h2>
          </div>

          {activeId && (
            <div className="flex shrink-0 items-center gap-1">
              <HeaderIconButton
                title={t("chat.share")}
                onClick={() => activeConversation && setShareTarget(activeConversation)}
              >
                <ShareGlyph />
              </HeaderIconButton>
              <HeaderIconButton title={t("chat.download")} onClick={exportChat}>
                <DownloadGlyph />
              </HeaderIconButton>
              <HeaderIconButton title={t("chat.clear")} onClick={clearChat}>
                <BroomGlyph />
              </HeaderIconButton>
            </div>
          )}
        </div>

        {offline && (
          <div className="bg-danger/10 px-4 py-1.5 text-center text-xs font-medium text-danger">
            {t("chat.offline")}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-6">
          {loadingConversation ? (
            <div className="mx-auto max-w-3xl space-y-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`flex gap-3 ${i % 2 ? "flex-row-reverse" : ""}`}>
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-mist" />
                  <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-mist" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <WelcomeScreen businessName={business.business_name} onPick={(t) => send(t)} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((m, idx) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  userName={userName}
                  isLastModelMessage={m.role === "model" && idx === lastModelIndex}
                  isLastUserMessage={m.role === "user" && idx === lastUserIndex}
                  reaction={reactions[m.id]}
                  onEditSubmit={editMessage}
                  onRegenerate={regenerate}
                  onContinue={continueGeneration}
                  onReact={react}
                  onRetry={m.status === "error" ? () => retryFailedMessage(m.id) : undefined}
                  sending={sending}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <Composer conversationId={activeId} sending={sending} onSend={send} onStop={stop} />
      </div>

      {shareTarget && (
        <ShareDialog
          conversation={shareTarget}
          onClose={() => setShareTarget(null)}
          onEnable={() => enableShare(shareTarget.id)}
          onDisable={() => disableShare(shareTarget.id)}
        />
      )}
    </div>
  );
}

function HeaderIconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 transition hover:bg-mist hover:text-ink active:scale-90"
    >
      {children}
    </button>
  );
}

function ShareGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
    </svg>
  );
}
function DownloadGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function BroomGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m19 5-9 9" />
      <path d="M3 21c1-4 3-6 6-8 1.5 1 2.5 2.5 3 4-2 3-4 5-8 6Z" />
      <path d="m14 6 4 4" />
    </svg>
  );
}
