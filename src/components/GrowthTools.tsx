"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GROWTH_TOOL_DEFINITIONS } from "@/lib/growthTools";
import type { GrowthToolContent, GrowthToolType } from "@/types";

interface Props {
  businessId: string;
  analysisId: string;
}

type ResultsMap = Partial<Record<GrowthToolType, GrowthToolContent>>;

export default function GrowthTools({ businessId, analysisId }: Props) {
  const { t } = useTranslation();
  const [results, setResults] = useState<ResultsMap>({});
  const [loadingTool, setLoadingTool] = useState<GrowthToolType | null>(null);
  const [errorByTool, setErrorByTool] = useState<Partial<Record<GrowthToolType, string>>>({});
  const [openTool, setOpenTool] = useState<GrowthToolType | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const activate = async (toolType: GrowthToolType) => {
    setLoadingTool(toolType);
    setErrorByTool((prev) => ({ ...prev, [toolType]: undefined }));

    try {
      const res = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, analysisId, toolType }),
      });

      let data: { tool?: { content?: GrowthToolContent }; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error(t("growth.errors.nonJsonResponse", { status: res.status }));
      }

      if (!res.ok) {
        throw new Error(data.error || t("growth.errors.generateFailed", { status: res.status }));
      }

      const content = data.tool?.content;
      if (!content || !content.title || !Array.isArray(content.sections)) {
        throw new Error(t("growth.errors.emptyResponse"));
      }

      if (!isMountedRef.current) return;

      setResults((prev) => ({ ...prev, [toolType]: content }));
      setOpenTool(toolType);
    } catch (err) {
      if (!isMountedRef.current) return;
      setErrorByTool((prev) => ({
        ...prev,
        [toolType]: err instanceof Error ? err.message : t("growth.errors.generationError"),
      }));
    } finally {
      if (isMountedRef.current) setLoadingTool(null);
    }
  };

  return (
    <div className="border-t border-border pt-6 mt-2 space-y-4">
      <div>
        <h4 className="font-semibold text-lg">{t("growth.sectionTitle")}</h4>
        <p className="text-sm text-ink/50 mt-1">{t("growth.sectionSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GROWTH_TOOL_DEFINITIONS.map((tool) => {
          const isLoading = loadingTool === tool.id;
          const hasResult = !!results[tool.id];
          const toolError = errorByTool[tool.id];

          return (
            <div
              key={tool.id}
              className="group rounded-2xl border border-border bg-mist/40 p-5 transition hover:-translate-y-0.5 hover:shadow-card hover:border-accent/40"
            >
              <div className="text-2xl">{tool.icon}</div>
              <h5 className="font-semibold mt-3">{t(tool.titleKey)}</h5>
              <p className="text-sm text-ink/50 mt-1 leading-relaxed">{t(tool.descriptionKey)}</p>

              <button
                onClick={() => activate(tool.id)}
                disabled={isLoading}
                className="btn-primary text-sm py-2 px-4 mt-4 w-full"
              >
                {isLoading ? t("growth.generating") : hasResult ? t("growth.regenerate") : t("growth.activate")}
              </button>

              {hasResult && !isLoading && (
                <button
                  onClick={() => setOpenTool(openTool === tool.id ? null : tool.id)}
                  className="text-xs text-accent mt-2 w-full text-center hover:underline"
                >
                  {openTool === tool.id ? t("growth.hideResult") : t("growth.showResult")}
                </button>
              )}

              {toolError && (
                <p className="text-danger text-xs badge-danger rounded-lg px-3 py-2 mt-3">
                  {toolError}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {openTool && results[openTool] && (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-lg">
              {GROWTH_TOOL_DEFINITIONS.find((tool) => tool.id === openTool)?.icon}{" "}
              {results[openTool]!.title}
            </h5>
            <button
              onClick={() => setOpenTool(null)}
              className="text-ink/40 hover:text-ink text-sm"
              aria-label={t("growth.close")}
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {results[openTool]!.sections.map((section, idx) => (
              <div key={idx}>
                <p className="text-xs uppercase tracking-wide text-ink/40 font-medium">
                  {section.label}
                </p>
                <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed mt-1">
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
