"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { UIMessage } from "./types";
import MarkdownMessage from "./MarkdownMessage";
import { UserAvatar, AiAvatar } from "./ChatAvatar";

function formatTime(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-mist active:scale-90 ${
        active ? "text-accent" : "text-ink/40 hover:text-ink/70"
      }`}
    >
      {children}
    </button>
  );
}

export default function MessageBubble({
  message,
  userName,
  isLastModelMessage,
  isLastUserMessage,
  reaction,
  onEditSubmit,
  onRegenerate,
  onContinue,
  onReact,
  onRetry,
  sending,
}: {
  message: UIMessage;
  userName: string;
  isLastModelMessage: boolean;
  isLastUserMessage: boolean;
  reaction?: "up" | "down" | null;
  onEditSubmit: (messageId: string, newText: string) => void;
  onRegenerate: () => void;
  onContinue: () => void;
  onReact: (messageId: string, reaction: "up" | "down") => void;
  onRetry?: () => void;
  sending: boolean;
}) {
  const isUser = message.role === "user";
  const { t, i18n } = useTranslation();
  const isStreaming = message.status === "streaming";
  const isPending = message.status === "pending";
  const isError = message.status === "error";
  const isEmpty = !isUser && message.content.length === 0 && (isStreaming || isPending);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(draft.length, draft.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(t("chat.copied"));
    } catch {
      toast.error(t("chat.copyError"));
    }
  };

  const submitEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setEditing(false);
    if (trimmed !== message.content) {
      onEditSubmit(message.id, trimmed);
    }
  };

  return (
    <div
      className={`group flex w-full animate-message-in gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {isUser ? (
        <UserAvatar name={userName || t("chat.you")} />
      ) : (
        <AiAvatar />
      )}

      <div className={`flex min-w-0 max-w-[min(720px,80%)] flex-col ${isUser ? "items-end" : "items-start"}`}>
        {editing ? (
          <div className="w-full min-w-[280px] rounded-2xl border border-accent bg-card p-3 shadow-sm">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                } else if (e.key === "Escape") {
                  setDraft(message.content);
                  setEditing(false);
                }
              }}
              rows={Math.min(8, Math.max(2, draft.split("\n").length))}
              className="w-full resize-none bg-transparent text-sm text-ink outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(false);
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-mist"
              >
                {t("chat.cancel")}
              </button>
              <button
                type="button"
                onClick={submitEdit}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                {t("chat.send")}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`min-w-0 rounded-2xl px-4 py-2.5 text-[0.925rem] shadow-sm ${
              isUser
                ? "rounded-br-md bg-accent text-white"
                : isError
                  ? "rounded-bl-md border border-danger/30 bg-danger/5 text-ink"
                  : "rounded-bl-md bg-mist text-ink"
            }`}
          >
            {isEmpty ? (
              <span className="inline-flex items-center gap-1 py-0.5" aria-label={t("chat.aiTyping")}>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40" />
              </span>
            ) : isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <>
                <MarkdownMessage content={message.content} />
                {isStreaming && message.content.length > 0 && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-caret-blink bg-ink/50" />
                )}
              </>
            )}
            {isError && message.errorText && (
              <p className="mt-1.5 flex items-center gap-2 text-xs text-danger">
                {message.errorText}
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-md bg-danger/10 px-2 py-0.5 font-medium hover:bg-danger/20"
                  >
                    {t("chat.retry")}
                  </button>
                )}
              </p>
            )}
          </div>
        )}

        <div className="mt-1 flex items-center gap-2 px-1">
          <span className="text-[11px] text-ink/35">{formatTime(message.created_at, i18n.language)}</span>

          {!editing && !isEmpty && (
            <div
              className={`flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${
                isStreaming ? "pointer-events-none opacity-0" : ""
              }`}
            >
              <ActionButton label={t("chat.copy")} onClick={handleCopy}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </ActionButton>

              {isUser && isLastUserMessage && (
                <ActionButton label={t("chat.edit")} onClick={() => setEditing(true)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </ActionButton>
              )}

              {!isUser && isLastModelMessage && !sending && (
                <>
                  <ActionButton label={t("chat.regenerate")} onClick={onRegenerate}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <path d="M21 3v6h-6" />
                    </svg>
                  </ActionButton>
                  <ActionButton label={t("chat.continue")} onClick={onContinue}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 4v16l14-8Z" />
                    </svg>
                  </ActionButton>
                </>
              )}

              {!isUser && (
                <>
                  <ActionButton
                    label={t("chat.goodResponse")}
                    active={reaction === "up"}
                    onClick={() => onReact(message.id, "up")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={reaction === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M7 10v12" />
                      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                    </svg>
                  </ActionButton>
                  <ActionButton
                    label={t("chat.badResponse")}
                    active={reaction === "down"}
                    onClick={() => onReact(message.id, "down")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={reaction === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M17 14V2" />
                      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
                    </svg>
                  </ActionButton>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
