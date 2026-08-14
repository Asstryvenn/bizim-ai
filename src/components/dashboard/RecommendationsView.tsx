import type { Recommendation } from "@/lib/supplyChain";
import Link from "next/link";

const SEVERITY_STYLES: Record<Recommendation["severity"], { icon: string; classes: string }> = {
  critical: { icon: "🔴", classes: "border-danger/30 bg-danger/5" },
  warning: { icon: "🟡", classes: "border-[rgb(234,179,8)]/30 bg-[rgb(234,179,8)]/5" },
  info: { icon: "🔵", classes: "border-accent/30 bg-accent-soft" },
};

export default function RecommendationsView({
  recommendations,
  hasData,
}: {
  recommendations: Recommendation[];
  hasData: boolean;
}) {
  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">✨ AI-рекомендации</h1>
        <p className="mt-1 text-ink/60 text-sm">
          Рекомендации формируются на основе ваших остатков, поставщиков и заказов
        </p>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-border bg-card shadow-card h-56 flex flex-col items-center justify-center text-ink/40 gap-2">
          <div className="text-5xl">✨</div>
          <p>Добавьте товары на странице «Остатки», чтобы получить рекомендации</p>
          <Link href="/dashboard/inventory" className="btn-primary mt-2">
            Перейти к остаткам
          </Link>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-card h-56 flex flex-col items-center justify-center text-ink/40 gap-2">
          <div className="text-5xl">✅</div>
          <p>Всё под контролем — критичных проблем не обнаружено</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const style = SEVERITY_STYLES[rec.severity];
            return (
              <div key={rec.id} className={`rounded-2xl border p-4 flex items-start gap-3 ${style.classes}`}>
                <span className="text-lg leading-none mt-0.5">{style.icon}</span>
                <p className="text-sm text-ink/80 leading-relaxed">{rec.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
