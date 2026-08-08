"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface DeleteModalProps {
  open: boolean;
  title?: string;
  description?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Универсальное модальное подтверждение удаления — заменяет window.confirm()
// во всех таблицах Admin Panel.
export default function DeleteModal({
  open,
  title,
  description,
  busy = false,
  onCancel,
  onConfirm,
}: DeleteModalProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const resolvedTitle = title ?? t("admin.deleteModal.title");
  const resolvedDescription = description ?? t("admin.deleteModal.description");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
      />
      <div className="relative card w-full max-w-sm animate-fade-in-up shadow-xl">
        <div className="w-11 h-11 rounded-full bg-danger/10 text-danger flex items-center justify-center text-xl mb-4">
          🗑️
        </div>
        <h2 className="text-lg font-semibold">{resolvedTitle}</h2>
        <p className="text-sm text-ink/60 mt-2">{resolvedDescription}</p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={onCancel}
            disabled={busy}
          >
            {t("chat.cancel")}
          </button>
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-danger px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t("admin.deleteModal.deleting") : t("admin.deleteModal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
