import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFeature } from "@/lib/subscription/serverGuard";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const guard = await requireFeature(supabase, user.id, "excel_import");
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const { businessId, fileName, fileType, rows } = body as {
    businessId: string;
    fileName: string;
    fileType: "csv" | "xlsx" | "json";
    rows: Record<string, unknown>[];
  };

  if (!businessId || !fileName || !fileType || !Array.isArray(rows)) {
    return NextResponse.json(
      { error: "Некорректные данные запроса" },
      { status: 400 }
    );
  }

  // Проверяем, что бизнес принадлежит текущему пользователю (доп. защита поверх RLS)
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", user.id)
    .single();

  if (businessError || !business) {
    return NextResponse.json(
      { error: "Бизнес не найден или не принадлежит пользователю" },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("imported_files")
    .insert({
      user_id: user.id,
      business_id: businessId,
      file_name: fileName,
      file_type: fileType,
      row_count: rows.length,
      parsed_data: rows,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ file: data });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const businessId = request.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId обязателен" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("imported_files")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ files: data });
}
