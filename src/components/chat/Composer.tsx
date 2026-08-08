"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function draftKey(conversationId: string | null) {
  return `bizim:chat:draft:${conversationId ?? "new"}`;
}

export default function Composer({
  conversationId,
  sending,
  disabled,
  onSend,
  onStop,
}: {
  conversationId: string | null;
  sending: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);

  // Восстанавливаем черновик при переключении диалога.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(draftKey(conversationId));
    setValue(saved ?? "");
  }, [conversationId]);

  // Сохраняем черновик по мере набора — если уйти со страницы и вернуться,
  // недописанный вопрос никуда не денется.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (value) window.localStorage.setItem(draftKey(conversationId), value);
      else window.localStorage.removeItem(draftKey(conversationId));
    } catch {
      // localStorage недоступен — не критично
    }
  }, [value, conversationId]);

  // Автовысота textarea (до 8 строк).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className="relative border-t border-border bg-paper/80 px-4 py-3 backdrop-blur-md sm:px-6"
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setDragging(false);
        toast.info(t("chat.uploadSoon"));
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-t-2xl border-2 border-dashed border-accent bg-accent-soft/80 backdrop-blur-sm animate-fade-in">
          <p className="text-sm font-medium text-accent">{t("chat.uploadDropHint")}</p>
        </div>
      )}

      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm transition focus-within:border-accent/50 focus-within:shadow-md">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={t("chat.composerPlaceholder")}
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-ink/35 outline-none disabled:opacity-50"
        />

        {sending ? (
          <button
            type="button"
            onClick={onStop}
            title={t("chat.stopGeneration")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-white transition hover:opacity-85 active:scale-90"
          >
            <span className="h-2.5 w-2.5 rounded-[2px] bg-white" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || disabled}
            title={t("chat.send")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90 active:scale-90 disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
      <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-ink/30">
        {t("chat.disclaimer")}
      </p>
    </div>
  );
}
