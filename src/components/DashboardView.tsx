"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import BusinessCard from "@/components/BusinessCard";
import DashboardCharts from "@/components/DashboardCharts";
import ImportPanel from "@/components/ImportPanel";
import DashboardNav from "@/components/DashboardNav";
import AIThinking from "@/components/AIThinking";
import {
  BusinessHealthScore,
  AIActionCenter,
  AIInsights,
  AIRecommendations,
  SmartAlerts,
} from "@/components/dashboard/AIInsightsSection";
import CustomerInsights from "@/components/dashboard/CustomerInsights";
import SalesAnalytics from "@/components/dashboard/SalesAnalytics";
import ExternalSignals from "@/components/dashboard/ExternalSignals";
import CampaignIntelligence from "@/components/dashboard/CampaignIntelligence";
import CampaignBuilderModal, {
  type CampaignBuilderRequest,
} from "@/components/dashboard/CampaignBuilderModal";
import { buildAIInsightsBundle, type CampaignSeed } from "@/lib/aiInsights";
import FeatureGate from "@/components/subscription/FeatureGate";
import SubscriptionStatusCard from "@/components/subscription/SubscriptionStatusCard";
import type { Business, ImportedFile, Subscription } from "@/types";
import type { ComputedStats } from "@/lib/analytics";
import i18n from "@/lib/i18n";

interface DashboardViewProps {
  business: Business;
  userEmail: string;
  files: ImportedFile[];
  analytics: ComputedStats;
  subscription: Subscription | null;
}

// Вся презентационная часть /dashboard вынесена сюда как клиентский компонент,
// чтобы использовать useTranslation — сама страница dashboard/page.tsx остаётся
// серверным компонентом и отвечает только за загрузку данных (Supabase не трогаем).
export default function DashboardView({
  business,
  userEmail,
  files,
  analytics,
  subscription,
}: DashboardViewProps) {
  const { t, i18n: i18next } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  const lang = i18next.language === "en" ? "en" : "ru";

  const latestFile = files[0];
  const rows = useMemo(() => latestFile?.parsed_data ?? [], [latestFile]);

  const aiBundle = useMemo(
    () => buildAIInsightsBundle(analytics, business, lang),
    [analytics, business, lang]
  );

  const topRecommendation = aiBundle.recommendations[0] ?? null;

  // Campaign Flow: единственный источник данных для Campaign Builder — это
  // campaignSeed самой AI-рекомендации/action-center item (см. aiInsights.ts).
  // createdCampaignIds — чисто клиентское состояние текущей сессии (ничего
  // не пишется в Supabase), нужно только чтобы после "Готово" CTA в
  // Recommendations/Action Center/Campaign Intelligence превращался в статус
  // "Кампания создана" вместо повторной кнопки.
  const [createdCampaignIds, setCreatedCampaignIds] = useState<Set<string>>(new Set());
  const [builderRequest, setBuilderRequest] = useState<CampaignBuilderRequest | null>(null);

  const handleActivateCampaign = (id: string, seed: CampaignSeed) => {
    setBuilderRequest({ id, seed });
  };

  const handleCampaignCreated = (id: string) => {
    setCreatedCampaignIds((prev) => new Set(prev).add(id));
    setBuilderRequest(null);
  };

  return (
    <main className="min-h-screen bg-paper">
      <DashboardNav
        businessName={business.business_name}
        isAdmin={business.role === "admin"}
        firstName={business.first_name}
        lastName={business.last_name}
        email={userEmail}
      />

      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
        {/* ---------- Hero: единая нейтральная визуальная система, без ---------- */}
        {/* ---------- больших ярких градиентов — см. редизайн дашборда. ---------- */}
        <section className="rounded-2xl border border-border bg-card p-8 sm:p-10 shadow-card">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-xl">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
                👋 {t("dashboard.hero.welcome")}, {business.first_name}
              </h1>
              <p className="mt-3 text-ink/60 leading-7">{t("dashboard.hero.subtitle")}</p>

              <div className="flex flex-wrap gap-3 mt-6">
                <Link href="/dashboard/chat" className="btn-primary">
                  🤖 {t("dashboard.hero.aiChat")}
                </Link>
                <a href="#import-panel" className="btn-secondary">
                  📊 {t("dashboard.hero.newAnalysis")}
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
              {[
                { icon: "📊", label: t("dashboard.hero.aiAnalysis") },
                { icon: "📈", label: t("dashboard.hero.growthTools") },
                { icon: "📱", label: "Instagram" },
                { icon: "🎥", label: "TikTok" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-mist/60 p-4 flex flex-col items-start gap-2 min-w-[110px]"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <p className="text-sm font-medium text-ink/80">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <AIThinking />

        {/* ---------- Подписка ---------- */}
        <SubscriptionStatusCard subscription={subscription} />

        {/* ---------- 1. Business Health Score (открыт как "витрина") ---------- */}
        <BusinessHealthScore bundle={aiBundle} />

        {/* ---------- 2. Sales Analytics ---------- */}
        <FeatureGate subscription={subscription} feature="basic_ai_analysis">
          <SalesAnalytics rows={rows} />
        </FeatureGate>

        {/* ---------- 3. AI Insights ---------- */}
        <FeatureGate subscription={subscription} feature="basic_ai_analysis">
          <AIInsights bundle={aiBundle} />
        </FeatureGate>

        {/* ---------- 4. AI Action Center (Growth+) ---------- */}
        <FeatureGate subscription={subscription} feature="campaign_intelligence">
          <AIActionCenter
            bundle={aiBundle}
            createdIds={createdCampaignIds}
            onActivate={handleActivateCampaign}
          />
        </FeatureGate>

        {/* ---------- 5. AI Recommendations ---------- */}
        <FeatureGate subscription={subscription} feature="basic_recommendations">
          <AIRecommendations
            bundle={aiBundle}
            createdIds={createdCampaignIds}
            onActivate={handleActivateCampaign}
          />
        </FeatureGate>

        {/* ---------- Campaign Intelligence (AI-слой над Growth Tools, Growth+) ---------- */}
        <FeatureGate subscription={subscription} feature="campaign_intelligence">
          <CampaignIntelligence
            topRecommendation={topRecommendation}
            createdIds={createdCampaignIds}
            onActivate={handleActivateCampaign}
          />
        </FeatureGate>

        {/* ---------- 6. Smart Alerts (Growth+) ---------- */}
        <FeatureGate subscription={subscription} feature="smart_alerts">
          <SmartAlerts bundle={aiBundle} />
        </FeatureGate>

        {/* ---------- 7. Customer Insights ---------- */}
        <FeatureGate subscription={subscription} feature="customer_insights">
          <CustomerInsights business={business} stats={analytics} />
        </FeatureGate>

        {/* ---------- 8. External Signals (Growth+) ---------- */}
        <FeatureGate subscription={subscription} feature="external_signals">
          <ExternalSignals city={business.city} />
        </FeatureGate>

        {/* ---------- 9. Существующие Growth Tools / история / импорт ---------- */}
        <BusinessCard business={business} />

        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight">📂 {t("dashboard.history.title")}</h2>
              <p className="text-ink/50 mt-1 text-sm">{t("dashboard.history.subtitle")}</p>
            </div>

            <Link href="/dashboard/chat" className="btn-primary shrink-0">
              🤖 {t("dashboard.hero.aiChat")}
            </Link>
          </div>

          {files.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-ink/40">
              <div className="text-6xl mb-4">📂</div>
              <p>{t("dashboard.history.empty")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {files.slice(0, 5).map((file) => (
                <div
                  key={file.id}
                  className="rounded-2xl border border-border bg-mist hover:bg-card hover:shadow-card transition p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <h3 className="font-semibold text-lg">📄 {file.file_name}</h3>
                    <p className="text-sm text-ink/50 mt-1">
                      {new Date(file.created_at).toLocaleDateString(locale)}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <span className="text-sm text-accent font-medium">
                      ✓ {t("dashboard.history.analysisComplete")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight mb-6">📊 {t("dashboard.stats.title")}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="card">
              <p className="text-ink/50 text-sm">{t("dashboard.stats.sales")}</p>
              <p className="text-3xl font-bold mt-3 tracking-tight">{analytics.totalRevenue ?? 0} ₸</p>
            </div>

            <div className="card">
              <p className="text-ink/50 text-sm">{t("dashboard.stats.clients")}</p>
              <p className="text-3xl font-bold mt-3 tracking-tight">{analytics.totalClients ?? 0}</p>
            </div>

            <div className="card">
              <p className="text-ink/50 text-sm">{t("dashboard.stats.averageCheck")}</p>
              <p className="text-3xl font-bold mt-3 tracking-tight">{analytics.averageCheck ?? 0} ₸</p>
            </div>

            <div className="card">
              <p className="text-ink/50 text-sm">{t("dashboard.stats.growth")}</p>
              <p className="text-3xl font-bold mt-3 tracking-tight text-success">
                {aiBundle.health.score}/100
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-stretch">
            <div id="import-panel" className="card h-full flex flex-col">
              <h3 className="text-xl font-bold mb-5">📥 {t("dashboard.stats.importExcel")}</h3>
              <div className="flex-1">
                <FeatureGate subscription={subscription} feature="excel_import">
                  <ImportPanel businessId={business.id} initialFiles={files} />
                </FeatureGate>
              </div>
            </div>

            <DashboardCharts stats={analytics} />
          </div>
        </section>
      </div>

      <CampaignBuilderModal
        request={builderRequest}
        onClose={() => setBuilderRequest(null)}
        onCreated={handleCampaignCreated}
      />
    </main>
  );
}
