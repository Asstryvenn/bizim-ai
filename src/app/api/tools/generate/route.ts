import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateGrowthTool, OpenAINotConfiguredError } from "@/lib/openai";
import { buildGrowthToolPrompt, getGrowthToolDefinition } from "@/lib/growthTools";
import type { Business, GrowthToolType } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { businessId, analysisId, toolType } = (await request.json()) as {
    businessId: string;
    analysisId: string;
    toolType: string;
  };

  if (!businessId || !analysisId || !toolType) {
    return NextResponse.json(
      { error: "businessId, analysisId и toolType обязательны" },
      { status: 400 }
    );
  }

  const toolDefinition = getGrowthToolDefinition(toolType);
  if (!toolDefinition) {
    return NextResponse.json({ error: "Неизвестный тип инструмента" }, { status: 400 });
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("user_id", user.id)
    .single();

  if (businessError || !business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }

  // Инструмент всегда строится на уже существующем AI-анализе —
  // без него генерация невозможна (никаких "советов из воздуха").
  const { data: analysis, error: analysisError } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .single();

  if (analysisError || !analysis) {
    return NextResponse.json(
      { error: "AI-анализ не найден. Сначала запустите анализ файла." },
      { status: 404 }
    );
  }

  const prompt = buildGrowthToolPrompt(toolType as GrowthToolType, {
    business: business as Business,
    analysisReport: analysis.report as string,
    stats: analysis.raw_stats,
  });

  try {
    const content = await generateGrowthTool(prompt);

    const { data: tool, error: insertError } = await supabase
      .from("growth_tools")
      .insert({
        user_id: user.id,
        business_id: businessId,
        analysis_id: analysisId,
        tool_type: toolType,
        title: content.title,
        content,
      })
      .select()
      .single();

    if (insertError) {
      console.error("SUPABASE GROWTH_TOOLS INSERT ERROR:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ tool });
  } catch (err) {
    console.error("========== GROWTH TOOL OPENAI ERROR ==========");
    console.error(err);
    console.error("================================================");

    if (err instanceof OpenAINotConfiguredError) {
      return NextResponse.json(
        { error: err.message, code: "OPENAI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
