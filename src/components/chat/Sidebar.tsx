"use client";

import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { ChatConversation } from "@/types";

function formatRelative(iso: string, t: TFunction, locale: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("sidebar.timeJustNow");
  if (diffMin < 60) return t("sidebar.timeMinutesAgo", { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t("sidebar.timeHoursAgo", { count: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return t("sidebar.timeYesterday");
  if (diffD < 7) return t("sidebar.timeDaysAgo", { count: diffD });
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

interface SidebarProps {
  conversations: ChatConversation[];
  activeId: string | null;
  collapsed: boolean;
  loading: boolean;
  onToggleCollapse: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onShare: (conversation: ChatConversation) => void;
}

export default function Sidebar({
  conversations,
  activeId,
  collapsed,
  loading,
  onToggleCollapse,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  onTogglePin,
  onShare,
}: SidebarProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.trim().toLowerCase())
  );
  const pinned = filtered.filter((c) => c.pinned);
  const recent = filtered.filter((c) => !c.pinned);

  const startRename = (c: ChatConversation) => {
    setRenamingId(c.id);
    setRenameValue(c.title);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) onRename(renamingId, trimmed);
    setRenamingId(null);
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-[68px] shrink-0 flex-col items-center gap-2 border-r border-border bg-mist/60 py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          title={t("sidebar.expand")}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-ink/50 transition hover:bg-mist hover:text-ink"
        >
          <SidebarIcon />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          title={t("sidebar.newChat")}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-sm transition hover:opacity-90 active:scale-95"
        >
          <PlusIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-mist/60">
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          title={t("sidebar.collapse")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink/50 transition hover:bg-mist hover:text-ink"
        >
          <SidebarIcon />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="flex flex-1 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
        >
          <PlusIcon /> {t("sidebar.newChat")}
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/30">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("sidebar.searchPlaceholder")}
            className="w-full rounded-xl border border-border bg-card py-2 pl-8 pr-3 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-accent/50"
          />
        </div>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="space-y-2 px-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-xl bg-card/60" />
            ))}
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <SidebarGroup title={t("sidebar.pinned")}>
                {pinned.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    active={c.id === activeId}
                    renaming={renamingId === c.id}
                    renameValue={renameValue}
                    confirmDelete={confirmDeleteId === c.id}
                    onRenameChange={setRenameValue}
                    onRenameCommit={commitRename}
                    onRenameCancel={() => setRenamingId(null)}
                    onSelect={() => onSelect(c.id)}
                    onStartRename={() => startRename(c)}
                    onTogglePin={() => onTogglePin(c.id, !c.pinned)}
                    onShare={() => onShare(c)}
                    onDeleteClick={() =>
                      confirmDeleteId === c.id ? onDelete(c.id) : setConfirmDeleteId(c.id)
                    }
                  />
                ))}
              </SidebarGroup>
            )}

            <SidebarGroup title={t("sidebar.recent")}>
              {recent.length === 0 && pinned.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-ink/35">
                  {search ? t("sidebar.noResults") : t("sidebar.noChats")}
                </p>
              ) : (
                recent.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    active={c.id === activeId}
                    renaming={renamingId === c.id}
                    renameValue={renameValue}
                    confirmDelete={confirmDeleteId === c.id}
                    onRenameChange={setRenameValue}
                    onRenameCommit={commitRename}
                    onRenameCancel={() => setRenamingId(null)}
                    onSelect={() => onSelect(c.id)}
                    onStartRename={() => startRename(c)}
                    onTogglePin={() => onTogglePin(c.id, !c.pinned)}
                    onShare={() => onShare(c)}
                    onDeleteClick={() =>
                      confirmDeleteId === c.id ? onDelete(c.id) : setConfirmDeleteId(c.id)
                    }
                  />
                ))
              )}
            </SidebarGroup>
          </>
        )}
      </div>
    </div>
  );
}

function SidebarGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-1">
      <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink/35">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  renaming,
  renameValue,
  confirmDelete,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onSelect,
  onStartRename,
  onTogglePin,
  onShare,
  onDeleteClick,
}: {
  conversation: ChatConversation;
  active: boolean;
  renaming: boolean;
  renameValue: string;
  confirmDelete: boolean;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onSelect: () => void;
  onStartRename: () => void;
  onTogglePin: () => void;
  onShare: () => void;
  onDeleteClick: () => void;
}) {
  const { t, i18n } = useTranslation();

  if (renaming) {
    return (
      <div className="flex items-center gap-1 rounded-xl bg-card px-2 py-1.5 ring-1 ring-accent">
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameCommit();
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={onRenameCommit}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
        active ? "bg-card shadow-sm ring-1 ring-border" : "hover:bg-card/70"
      }`}
    >
      <span className={`truncate flex-1 ${active ? "font-medium text-ink" : "text-ink/70"}`}>
        {conversation.pinned && <span className="mr-1 text-accent">📌</span>}
        {conversation.title}
      </span>
      <span className="shrink-0 text-[10px] text-ink/30 group-hover:hidden">
        {formatRelative(conversation.updated_at, t, i18n.language)}
      </span>

      <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <RowIconButton
          title={conversation.pinned ? t("sidebar.unpin") : t("sidebar.pin")}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
        >
          <PinIcon filled={conversation.pinned} />
        </RowIconButton>
        <RowIconButton
          title={t("sidebar.rename")}
          onClick={(e) => {
            e.stopPropagation();
            onStartRename();
          }}
        >
          <PencilIcon />
        </RowIconButton>
        <RowIconButton
          title={t("sidebar.share")}
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
        >
          <ShareIcon />
        </RowIconButton>
        <RowIconButton
          title={confirmDelete ? t("sidebar.confirmDelete") : t("sidebar.delete")}
          danger={confirmDelete}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick();
          }}
        >
          <TrashIcon />
        </RowIconButton>
      </span>
    </button>
  );
}

function RowIconButton({
  title,
  onClick,
  children,
  danger,
}: {
  title: string;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-mist active:scale-90 ${
        danger ? "text-danger" : "text-ink/40 hover:text-ink/80"
      }`}
    >
      {children}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}
function PinIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M12 17v5" />
      <path d="M9 3h6l1 6 3 3v2H5v-2l3-3Z" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
