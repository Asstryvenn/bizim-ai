"use client";

import { useTranslation } from "react-i18next";

const PROMPT_ICONS: Record<string, string> = {
  analyze: "📊",
  instagram: "📸",
  campaign: "🚀",
  sales: "💰",
};

const PROMPT_KEYS = ["analyze", "instagram", "campaign", "sales"] as const;

export default function WelcomeScreen({
  businessName,
  onPick,
}: {
  businessName: string;
  onPick: (text: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center animate-fade-in-up">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-accent text-3xl shadow-lg shadow-accent/20">
        👋
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t("chat.welcomeTitle")}</h1>
      <p className="mt-2 max-w-md text-sm text-ink/55">
        {t("chat.welcomeSubtitle", { businessName })}
      </p>

      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {PROMPT_KEYS.map((key) => {
          const title = t(`chat.prompts.${key}.title`);
          const text = t(`chat.prompts.${key}.text`);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(text)}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md active:translate-y-0"
            >
              <span className="text-xl">{PROMPT_ICONS[key]}</span>
              <span>
                <span className="block text-sm font-semibold text-ink">{title}</span>
                <span className="mt-0.5 block text-xs text-ink/50 group-hover:text-ink/70">{text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
