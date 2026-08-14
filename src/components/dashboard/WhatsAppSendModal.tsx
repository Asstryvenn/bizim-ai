"use client";

import { useState } from "react";
import { toast } from "sonner";
import { buildOrderWhatsAppMessage } from "@/lib/whatsapp/orderMessage";
import type { Business, PurchaseOrderWithDetails } from "@/types";

interface WhatsAppSendModalProps {
  business: Business;
  order: PurchaseOrderWithDetails;
  onClose: () => void;
  onSent: (whatsappMessageId: string) => void;
}

type Outcome = { sent: true } | { sent: false; configured: false } | null;

export default function WhatsAppSendModal({ business, order, onClose, onSent }: WhatsAppSendModalProps) {
  const [message, setMessage] = useState(() => buildOrderWhatsAppMessage(business, order));
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [error, setError] = useState<string | null>(null);

  const supplierPhone = order.supplier?.whatsapp_phone || order.supplier?.phone || null;
  const waLink = supplierPhone
    ? `https://wa.me/${supplierPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`
    : null;

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось отправить сообщение");
      }
      if (data.sent) {
        setOutcome({ sent: true });
        toast.success("Сообщение отправлено поставщику через WhatsApp");
        onSent(data.messageId);
      } else {
        setOutcome({ sent: false, configured: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    toast.success("Сообщение скопировано");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-card space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Сообщение поставщику</h2>
          <button type="button" onClick={onClose} className="rounded-full h-8 w-8 flex items-center justify-center text-ink/40 hover:bg-mist">
            ✕
          </button>
        </div>

        {outcome?.sent ? (
          <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            ✓ Отправлено поставщику «{order.supplier?.name}» через WhatsApp.
          </div>
        ) : outcome && !outcome.sent ? (
          <div className="space-y-3">
            <p className="text-sm text-ink/70 rounded-xl bg-mist px-4 py-3">
              WhatsApp API не подключён. Скопируйте сообщение и отправьте его вручную.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleCopy} className="btn-secondary flex-1">
                Скопировать сообщение
              </button>
              {waLink && (
                <a href={waLink} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-center">
                  Открыть WhatsApp
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            <textarea
              className="input min-h-[220px] font-sans text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {error && <p className="text-danger text-sm badge-danger rounded-lg px-4 py-3">{error}</p>}
            {!supplierPhone && (
              <p className="text-xs text-danger">
                У поставщика не указан телефон/WhatsApp — добавьте его на странице «Поставщики».
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Отмена
              </button>
              <button type="button" onClick={handleSend} disabled={sending || !supplierPhone} className="btn-primary">
                {sending ? "Отправка..." : "Отправить"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
