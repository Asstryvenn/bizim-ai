import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeStats } from "@/lib/analytics";
import { generateAnalysisReport, OpenAINotConfiguredError } from "@/lib/openai";
import type { ParsedRow } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { businessId, fileId } = (await request.json()) as {
    businessId: string;
    fileId: string;
  };

  if (!businessId || !fileId) {
    return NextResponse.json(
      { error: "businessId и fileId обязательны" },
      { status: 400 }
    );
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

  const { data: file, error: fileError } = await supabase
    .from("imported_files")
    .select("*")
    .eq("id", fileId)
    .eq("business_id", businessId)
    .single();

  if (fileError || !file) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  const rows = file.parsed_data as ParsedRow[];
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: "В файле нет данных для анализа. Недостаточно данных." },
      { status: 422 }
    );
  }

  const stats = computeStats(rows);

  const prompt = `Ты — финансовый аналитик для малого бизнеса в Казахстане.
Бизнес: "${business.business_name}" (тип: ${business.business_type}), город ${business.city}.
Основная заявленная проблема бизнеса: ${business.main_problem || "не указана"}.

Вот реальные посчитанные метрики из загруженного файла (${file.file_name}, ${rows.length} строк).
Используй ТОЛЬКО эти цифры. Не придумывай других чисел. Если каких-то данных нет (null) — прямо скажи, что этой метрики не хватает.

Метрики:
${JSON.stringify(stats, null, 2)}

Напиши краткий практичный отчёт на русском языке (5-8 предложений) в стиле:
- какой день/период сильнее и слабее по выручке или клиентам;
- есть ли рост или падение;
- 1-2 конкретные рекомендации для владельца бизнеса, основанные именно на этих цифрах.
Не используй общие фразы без опоры на цифры выше. Если метрик мало для выводов — честно об этом скажи.`;

  try {
    const report = await generateAnalysisReport(prompt);

    const { data: analysis, error: analysisError } = await supabase
      .from("ai_analyses")
      .insert({
        user_id: user.id,
        business_id: businessId,
        source_file_id: fileId,
        report,
        raw_stats: stats,
      })
      .select()
      .single();

   if (analysisError) {
  console.error("SUPABASE INSERT ERROR:");
  console.error(analysisError);

  return NextResponse.json(
    { error: analysisError.message },
    { status: 500 }
  );
}

    await supabase
      .from("businesses")
      .update({ last_analysis: report, last_analysis_at: new Date().toISOString() })
      .eq("id", businessId);

    return NextResponse.json({ analysis });
 } catch (err) {
  console.error("========== OPENAI ERROR ==========");
  console.error(err);
  console.error("==================================");

  if (err instanceof OpenAINotConfiguredError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "OPENAI_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: err instanceof Error ? err.message : String(err),
    },
    { status: 500 }
  );
}
}
