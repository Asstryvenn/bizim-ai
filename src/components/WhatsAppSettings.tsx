"use client";

import { useEffect, useState } from "react";
import type { Business } from "@/types";

export default function WhatsAppSettings({ business }: { business: Business }) {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/settings/whatsapp-status")
      .then((res) => res.json())
      .then((data) => setConnected(Boolean(data.connected)))
      .catch(() => setConnected(false));
  }, []);

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-semibold">WhatsApp Business</h3>
        <p className="text-sm text-ink/50 mt-1">
          Используется для отправки заказов поставщикам напрямую из Bizim.
        </p>
      </div>

      {connected === null ? (
        <p className="text-sm text-ink/40">Проверяем подключение...</p>
      ) : connected ? (
        <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3">
          <span className="text-success">✓</span>
          <div>
            <p className="text-sm font-medium text-success">WhatsApp подключён</p>
            {business.whatsapp_phone && (
              <p className="text-xs text-ink/50 mt-0.5">Номер бизнеса: {business.whatsapp_phone}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-mist px-4 py-3 space-y-2">
          <p className="text-sm text-ink/70">WhatsApp пока не подключён.</p>
          <p className="text-xs text-ink/50">
            Чтобы подключить WhatsApp Business Cloud API, добавьте в переменные окружения проекта:
            {" "}
            <code className="text-[11px] bg-card px-1.5 py-0.5 rounded">WHATSAPP_ACCESS_TOKEN</code>,{" "}
            <code className="text-[11px] bg-card px-1.5 py-0.5 rounded">WHATSAPP_PHONE_NUMBER_ID</code> и{" "}
            <code className="text-[11px] bg-card px-1.5 py-0.5 rounded">WHATSAPP_BUSINESS_ACCOUNT_ID</code>,
            полученные в Meta for Developers. До этого момента сообщения поставщикам можно скопировать и
            отправить вручную — так и сделает кнопка «Отправить в WhatsApp» в заказе.
          </p>
        </div>
      )}
    </div>
  );
}
