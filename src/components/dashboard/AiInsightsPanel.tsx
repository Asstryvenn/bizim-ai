"use client";

import { useEffect, useState } from "react";
import type { StructuredAnalysis } from "@/lib/aiAnalysis";

const SEVERITY_ICON: Record<string, string> = {
  high: "⚠",
  medium: "⚠",
  low: "↓",
  info: "✓",
};

export default function AiInsightsPanel() {
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);

  useEffect(() => {
    fetch("/api/ai/analyze")
      .then((res) => (res.ok ? res.json() : null))
      .then(setAnalysis)
      .catch(() => setAnalysis(null));
  }, []);

  if (!analysis) return null;

  const items = [
    ...analysis.risks.map((r) => ({ text: `${r.title}`, severity: r.severity })),
    ...analysis.insights.map((i) => ({ text: i.title, severity: i.severity })),
  ].slice(0, 5);

  if (items.length === 0 && analysis.insufficient_data.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-3">
      <h2 className="text-lg font-bold tracking-tight">🤖 AI Insights</h2>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, i) => (
            <p key={i} className="text-sm text-ink/70 flex items-start gap-2">
              <span>{SEVERITY_ICON[item.severity] ?? "•"}</span>
              <span>{item.text}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink/40">{analysis.insufficient_data[0]}</p>
      )}
    </section>
  );
}
