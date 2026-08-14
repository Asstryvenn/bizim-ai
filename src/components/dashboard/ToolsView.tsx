"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { activateTool, toggleToolFavorite } from "@/lib/supplyChainActions";
import { TOOL_DEFINITIONS } from "@/lib/tools";
import type { Business, BusinessTool, ToolCategory } from "@/types";

const CATEGORIES: (ToolCategory | "all")[] = ["all", "Склад", "Закупки", "Поставщики", "Аналитика", "Уведомления"];

export default function ToolsView({
  business,
  initialBusinessTools,
}: {
  business: Business;
  initialBusinessTools: BusinessTool[];
}) {
  const router = useRouter();
  const [businessTools, setBusinessTools] = useState(initialBusinessTools);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ToolCategory | "all">("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const stateByKey = useMemo(() => new Map(businessTools.map((bt) => [bt.tool_key, bt])), [businessTools]);

  const filtered = TOOL_DEFINITIONS.filter((tool) => {
    const matchesSearch =
      tool.title.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || tool.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleFavorite = async (toolKey: string) => {
    const current = stateByKey.get(toolKey);
    const nextFavorite = !current?.is_favorite;
    setBusyKey(toolKey);
    try {
      const supabase = createClient();
      await toggleToolFavorite(supabase, business.id, toolKey, nextFavorite);
      setBusyKey(null);
      setBusinessTools((prev) => {
        const others = prev.filter((bt) => bt.tool_key !== toolKey);
        return [
          ...others,
          {
            id: current?.id ?? toolKey,
            business_id: business.id,
            tool_key: toolKey,
            is_favorite: nextFavorite,
            is_active: current?.is_active ?? false,
            updated_at: new Date().toISOString(),
            created_at: current?.created_at ?? new Date().toISOString(),
          },
        ];
      });
      toast.success(nextFavorite ? "Добавлено в избранное" : "Убрано из избранного");
    } catch (err) {
      setBusyKey(null);
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  };

  const handleActivate = async (toolKey: string, title: string) => {
    setBusyKey(toolKey);
    try {
      const supabase = createClient();
      await activateTool(supabase, business.id, toolKey, title);
      setBusinessTools((prev) => {
        const current = prev.find((bt) => bt.tool_key === toolKey);
        const others = prev.filter((bt) => bt.tool_key !== toolKey);
        return [
          ...others,
          {
            id: current?.id ?? toolKey,
            business_id: business.id,
            tool_key: toolKey,
            is_favorite: current?.is_favorite ?? false,
            is_active: true,
            updated_at: new Date().toISOString(),
            created_at: current?.created_at ?? new Date().toISOString(),
          },
        ];
      });
      toast.success(`Инструмент «${title}» активирован`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось активировать");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">🧰 Каталог бизнес-инструментов</h1>
        <p className="mt-1 text-ink/60 text-sm">Инструменты для снабжения и логистики малого бизнеса</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск инструмента..."
          className="input sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-sm border transition ${
                category === c
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-ink/60 hover:bg-mist"
              }`}
            >
              {c === "all" ? "Все" : c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tool) => {
          const state = stateByKey.get(tool.key);
          const isFavorite = state?.is_favorite ?? false;
          const isActive = state?.is_active ?? false;
          const busy = busyKey === tool.key;
          return (
            <div key={tool.key} className="card flex flex-col">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-xl">
                  {tool.icon}
                </span>
                <button
                  type="button"
                  onClick={() => handleFavorite(tool.key)}
                  disabled={busy}
                  aria-label="В избранное"
                  className={`text-lg ${isFavorite ? "text-[rgb(234,179,8)]" : "text-ink/25 hover:text-ink/50"}`}
                >
                  {isFavorite ? "★" : "☆"}
                </button>
              </div>
              <span className="mt-3 inline-flex w-fit items-center rounded-full bg-mist px-2.5 py-0.5 text-xs text-ink/50">
                {tool.category}
              </span>
              <h3 className="mt-3 font-semibold tracking-tight">{tool.title}</h3>
              <p className="mt-1.5 text-sm text-ink/60 leading-relaxed flex-1">{tool.description}</p>

              <div className="mt-4 flex items-center gap-2">
                <Link href={tool.href} className="btn-secondary text-sm flex-1 text-center">
                  Открыть
                </Link>
                {!isActive ? (
                  <button
                    type="button"
                    onClick={() => handleActivate(tool.key, tool.title)}
                    disabled={busy}
                    className="btn-primary text-sm flex-1"
                  >
                    {busy ? "..." : "Активировать"}
                  </button>
                ) : (
                  <span className="flex-1 text-center text-xs font-medium text-success py-2">✓ Активен</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
