"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { ChatConversation } from "@/types";

export default function ShareDialog({
  conversation,
  onClose,
  onEnable,
  onDisable,
}: {
  conversation: ChatConversation;
  onClose: () => void;
  onEnable: () => Promise<string>;
  onDisable: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(conversation.shared);

  useEffect(() => {
    if (conversation.shared && conversation.share_id) {
      setShareUrl(`${window.location.origin}/share/${conversation.share_id}`);
    }
  }, [conversation]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const shareId = await onEnable();
      setShareUrl(`${window.location.origin}/share/${shareId}`);
      setEnabled(true);
    } catch {
      toast.error(t("share.createError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await onDisable();
      setEnabled(false);
      setShareUrl(null);
    } catch {
      toast.error(t("share.disableError"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("share.copied"));
    } catch {
      toast.error(t("share.copyError"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in-up"
      >
        <h3 className="text-lg font-semibold text-ink">{t("share.title")}</h3>
        <p className="mt-1 text-sm text-ink/55">{t("share.description")}</p>

        {enabled && shareUrl ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-mist px-3 py-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 truncate bg-transparent text-sm text-ink/80 outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                {t("share.copyButton")}
              </button>
            </div>
            <button
              type="button"
              onClick={handleDisable}
              disabled={loading}
              className="text-sm font-medium text-danger hover:underline disabled:opacity-50"
            >
              {loading ? t("share.disabling") : t("share.disable")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="btn-primary mt-4 w-full"
          >
            {loading ? t("share.creating") : t("share.createButton")}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-border py-2 text-sm font-medium text-ink/60 hover:bg-mist"
        >
          {t("share.close")}
        </button>
      </div>
    </div>
  );
}
