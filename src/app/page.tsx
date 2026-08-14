"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import ThemeToggle from "@/components/admin/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AuthConfirmationHandler from "@/components/AuthConfirmationHandler";
import { BUSINESS_TYPES } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Иконки (маленькие inline SVG в духе Lucide/Linear — без новой зависимости,
// т.к. lucide-react не установлен в проекте).
// ---------------------------------------------------------------------------
function IconUpload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconTrend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 5h16v11H8l-4 4V5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.4l-1.8-4.9L5 9.7l5.2-1.8L12 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
function IconBuilding({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 21V6l8-3 8 3v15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 21v-4h6v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURE_ICONS = [IconUpload, IconChart, IconTrend, IconChat, IconSparkle, IconBuilding];
const FEATURE_KEYS = ["import", "analytics", "days", "aiConsultant", "growthTools", "profile"] as const;
const STEP_KEYS = ["register", "upload", "aiReview"] as const;
const GROWTH_TEASER_KEYS = ["promo", "instagram", "tiktok", "loyalty", "coupons", "sms", "profitTips"] as const;

export default function HomePage() {
  const { t } = useTranslation();
  const businessTypes = BUSINESS_TYPES.filter((bt) => bt.value !== "other");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <AuthConfirmationHandler />
      {/* Декоративное свечение фона — в духе Vercel/Linear, завязано на акцентный цвет темы */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] overflow-hidden">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[rgb(var(--color-accent)/0.16)] blur-[110px]" />
        <div className="absolute right-[-120px] top-[80px] h-[320px] w-[320px] rounded-full bg-[rgb(var(--color-accent)/0.12)] blur-[100px]" />
      </div>

      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-paper/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto w-full px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">
              B
            </span>
            <span className="text-lg font-semibold tracking-tight">Bizim</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-ink/60">
            <a href="#features" className="transition hover:text-ink">
              {t("landing.nav.features")}
            </a>
            <a href="#how" className="transition hover:text-ink">
              {t("landing.nav.howItWorks")}
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link href="/login" className="btn-secondary text-sm py-2 px-4">
              {t("landing.nav.login")}
            </Link>
            <Link href="/register" className="btn-primary text-sm py-2 px-4">
              {t("landing.nav.startFree")}
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="max-w-6xl mx-auto w-full px-6 pt-20 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-ink/70 shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t("landing.hero.badge")}
            </div>

            <h1 className="mt-6 text-4xl md:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.08]">
              {t("landing.hero.titleLine1")}
              <br />
              {t("landing.hero.titleLine2")}{" "}
              <span className="bg-gradient-to-r from-accent to-[rgb(var(--color-accent)/0.55)] bg-clip-text text-transparent">
                {t("landing.hero.titleHighlight")}
              </span>
            </h1>

            <p className="mt-6 text-lg text-ink/60 max-w-lg">{t("landing.hero.description")}</p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/register" className="btn-primary group text-sm">
                {t("landing.hero.createAccount")}
                <IconArrowRight className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#how" className="btn-secondary text-sm">
                {t("landing.nav.howItWorks")}
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-2 text-xs text-ink/45">
              <span className="mr-1">{t("landing.hero.suitableFor")}</span>
              {businessTypes.map((bt) => (
                <span
                  key={bt.value}
                  className="rounded-full border border-border bg-mist px-3 py-1 text-ink/60"
                >
                  {t(bt.labelKey)}
                </span>
              ))}
            </div>
          </div>

          {/* ---------- Hero visual: стилизованный превью дашборда ---------- */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <div className="card shadow-xl rotate-1 hover:rotate-0 transition-transform duration-500">
              <div className="flex items-center gap-1.5 pb-4 border-b border-border">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-[rgb(234,179,8)]/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <span className="ml-3 text-xs text-ink/40">{t("landing.hero.mockDashboardLabel")}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="rounded-xl bg-mist p-3.5">
                  <p className="text-[11px] text-ink/50">{t("dashboard.stats.sales")}</p>
                  <p className="mt-1 text-lg font-semibold">₸ 2 480 000</p>
                </div>
                <div className="rounded-xl bg-mist p-3.5">
                  <p className="text-[11px] text-ink/50">{t("dashboard.card.averageCheck")}</p>
                  <p className="mt-1 text-lg font-semibold">₸ 3 150</p>
                </div>
                <div className="rounded-xl bg-mist p-3.5">
                  <p className="text-[11px] text-ink/50">{t("dashboard.stats.clients")}</p>
                  <p className="mt-1 text-lg font-semibold">786</p>
                </div>
              </div>

              <div className="mt-5 flex items-end gap-2 h-28">
                {[38, 55, 44, 70, 82, 60, 91].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-md bg-accent/80" style={{ height: `${h}%`, opacity: 0.55 + i * 0.06 }} />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-ink/40">
                {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => (
                  <span key={day}>{t(`weekday.short.${day}`)}</span>
                ))}
              </div>
            </div>

            {/* Плавающая карточка с "AI-инсайтом" */}
            <div
              className="card absolute -bottom-8 -left-6 max-w-[240px] shadow-xl animate-fade-in-up hidden sm:block"
              style={{ animationDelay: "280ms" }}
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <IconSparkle className="h-4 w-4" />
                </span>
                <p className="text-xs text-ink/70 leading-relaxed">
                  <span className="font-medium text-ink">AI:</span> {t("landing.hero.aiInsight")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Снабжение и логистика (SERPIN BUSINESS TOURNAMENT) ---------- */}
      <section className="max-w-6xl mx-auto w-full px-6 py-4">
        <div className="card overflow-hidden">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                📦 Новое: снабжение и логистика
              </span>
              <h3 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight">
                Управляйте запасами и закупками без сложной ERP
              </h3>
              <p className="mt-3 text-sm text-ink/60 leading-relaxed max-w-md">
                Bizim следит за остатками, сам считает, когда и сколько заказывать, сравнивает
                поставщиков и предупреждает о рисках дефицита — до того, как товар закончится.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register" className="btn-primary text-sm">
                  Начать использовать
                </Link>
                <Link href="/register" className="btn-secondary text-sm">
                  Проверить остатки
                </Link>
                <Link href="/register" className="btn-secondary text-sm">
                  Добавить поставщика
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-mist p-4">
                <p className="text-xs text-ink/50">Товаров под риском</p>
                <p className="mt-1 text-2xl font-bold">3</p>
              </div>
              <div className="rounded-xl bg-mist p-4">
                <p className="text-xs text-ink/50">Экономия в месяц</p>
                <p className="mt-1 text-2xl font-bold text-success">₸84 500</p>
              </div>
              <div className="rounded-xl bg-mist p-4">
                <p className="text-xs text-ink/50">Поставок в пути</p>
                <p className="mt-1 text-2xl font-bold">4</p>
              </div>
              <div className="rounded-xl bg-mist p-4">
                <p className="text-xs text-ink/50">Заказов можно автоматизировать</p>
                <p className="mt-1 text-2xl font-bold text-accent">6</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="max-w-6xl mx-auto w-full px-6 py-24 scroll-mt-20">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-accent">{t("landing.nav.features")}</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            {t("landing.features.title")}
          </h2>
          <p className="mt-4 text-ink/60">{t("landing.features.subtitle")}</p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_KEYS.map((key, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div
                key={key}
                className="card animate-fade-in-up transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{t(`landing.features.items.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm text-ink/60 leading-relaxed">
                  {t(`landing.features.items.${key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="max-w-6xl mx-auto w-full px-6 py-24 scroll-mt-20">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-accent">{t("landing.nav.howItWorks")}</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">{t("landing.how.title")}</h2>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          {STEP_KEYS.map((key, i) => (
            <div key={key} className="animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="text-4xl font-semibold tracking-tight text-ink/10">{`0${i + 1}`}</span>
              <h3 className="mt-3 font-semibold tracking-tight">{t(`landing.how.steps.${key}.title`)}</h3>
              <p className="mt-1.5 text-sm text-ink/60 leading-relaxed max-w-xs">
                {t(`landing.how.steps.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Growth tools teaser ---------- */}
      <section className="max-w-6xl mx-auto w-full px-6 py-4">
        <div className="card overflow-hidden">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                <IconSparkle className="h-3.5 w-3.5" />
                {t("landing.growthTeaser.badge")}
              </span>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">{t("landing.growthTeaser.title")}</h3>
              <p className="mt-3 text-sm text-ink/60 leading-relaxed max-w-md">
                {t("landing.growthTeaser.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {GROWTH_TEASER_KEYS.map((key) => (
                <span
                  key={key}
                  className="rounded-xl border border-border bg-mist px-3.5 py-2 text-sm text-ink/70"
                >
                  {t(`landing.growthTeaser.items.${key}`)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="max-w-6xl mx-auto w-full px-6 py-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-mist px-8 py-16 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[240px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--color-accent)/0.18)] blur-[100px]" />
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("landing.cta.title")}</h2>
          <p className="mt-4 text-ink/60 max-w-md mx-auto">{t("landing.cta.description")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn-primary text-sm">
              {t("landing.nav.startFree")}
            </Link>
            <Link href="/login" className="btn-secondary text-sm">
              {t("landing.cta.haveAccount")}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto w-full px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
              B
            </span>
            <span className="text-sm font-medium text-ink/70">Bizim</span>
            <span className="text-sm text-ink/35">— {t("landing.footer.tagline")}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-ink/45">
            <a href="#features" className="transition hover:text-ink">
              {t("landing.nav.features")}
            </a>
            <a href="#how" className="transition hover:text-ink">
              {t("landing.nav.howItWorks")}
            </a>
            <Link href="/login" className="transition hover:text-ink">
              {t("landing.nav.login")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
