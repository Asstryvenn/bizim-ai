"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CampaignSeed } from "@/lib/aiInsights";

export interface CampaignBuilderRequest {
  id: string;
  seed: CampaignSeed;
}

interface Props {
  request: CampaignBuilderRequest | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}

// Внутренний Campaign Flow: НЕ вызывает никакой рекламный API и никуда не
// публикует акцию — только предзаполненная форма поверх recommendation/action
// center item (единственный источник данных, см. CampaignSeed в aiInsights.ts)
// и локальный success-state, чтобы продемонстрировать переход
// insight → action без редиректа на Import Excel.
export default function CampaignBuilderModal({ request, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [period, setPeriod] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [discount, setDiscount] = useState("");
  const [description, setDescription] = useState("");
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (request) {
      setName(request.seed.name);
      setPeriod(request.seed.period);
      setCampaignType(request.seed.campaignType);
      setDiscount(request.seed.discount);
      setDescription(request.seed.description);
      setCreated(false);
    }
  }, [request]);

  if (!request) return null;

  const handleClose = () => {
    onClose();
  };

  const handleCreate = () => {
    setCreated(true);
  };

  const handleDone = () => {
    onCreated(request.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {!created ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight mb-4">
              🚀 {t("aiDashboard.campaignBuilder.title")}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="label">{t("aiDashboard.campaignBuilder.name")}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <label className="label">{t("aiDashboard.campaignBuilder.reason")}</label>
                <p className="text-sm text-ink/60 rounded-xl border border-border bg-mist/60 px-3 py-2">
                  {request.seed.reason}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("aiDashboard.campaignBuilder.period")}</label>
                  <input
                    className="input"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">{t("aiDashboard.campaignBuilder.type")}</label>
                  <input
                    className="input"
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t("aiDashboard.campaignBuilder.discount")}</label>
                <input
                  className="input"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>

              <div>
                <label className="label">{t("aiDashboard.campaignBuilder.description")}</label>
                <textarea
                  className="input min-h-[72px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {request.seed.expectedImpact && (
                <p className="text-sm">
                  <span className="text-ink/50">{t("aiDashboard.recommendations.expected")}: </span>
                  <span className="font-medium text-success">{request.seed.expectedImpact}</span>
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary text-sm py-2 px-4" onClick={handleClose}>
                {t("aiDashboard.campaignBuilder.cancel")}
              </button>
              <button type="button" className="btn-primary text-sm py-2 px-4" onClick={handleCreate}>
                {t("aiDashboard.campaignBuilder.create")}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4 animate-fade-in">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-3xl text-success">
              ✓
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">
              {t("aiDashboard.campaignBuilder.created")}
            </h2>
            <p className="mt-1 text-sm text-ink/70">{name}</p>
            <p className="mt-1 text-sm text-ink/50">{t("aiDashboard.campaignBuilder.ready")}</p>

            <button
              type="button"
              className="btn-primary text-sm py-2 px-6 mt-5"
              onClick={handleDone}
            >
              {t("aiDashboard.campaignBuilder.done")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
