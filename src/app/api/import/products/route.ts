import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeProductMetrics } from "@/lib/salesAnalytics";
import type { MappableField } from "@/lib/importMapping";
import type { InventoryItem, Sale } from "@/types";

interface RequestBody {
  rows: Record<string, unknown>[];
  mapping: Record<string, MappableField | null>; // column -> field
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Реальный импорт продаж по товарам: строки только валидируются и
// нормализуются, ничего не придумывается. Товары без current_stock
// остаются с тем, что уже было (или 0) — Excel с историей продаж не
// говорит нам текущий остаток, поэтому он не подменяется угаданным числом.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).single();
  if (!business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }
  const businessId = business.id as string;

  const body = (await request.json()) as RequestBody;
  const { rows, mapping } = body;

  const productColumn = Object.entries(mapping).find(([, f]) => f === "product")?.[0];
  const quantityColumn = Object.entries(mapping).find(([, f]) => f === "quantity")?.[0];
  const dateColumn = Object.entries(mapping).find(([, f]) => f === "date")?.[0];
  const priceColumn = Object.entries(mapping).find(([, f]) => f === "price")?.[0];

  if (!productColumn || !quantityColumn || !dateColumn) {
    return NextResponse.json(
      { error: "Нужно указать колонки: товар, количество, дата" },
      { status: 422 }
    );
  }

  const { data: existingItems } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("business_id", businessId);

  const itemsByName = new Map<string, InventoryItem>();
  for (const item of (existingItems as InventoryItem[]) ?? []) {
    itemsByName.set(item.name.trim().toLowerCase(), item);
  }

  const newSalesByProductId = new Map<string, { quantity: number; unit_price: number | null; sold_at: string }[]>();
  const createdProductNames: string[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const nameRaw = row[productColumn];
    const name = typeof nameRaw === "string" ? nameRaw.trim() : nameRaw != null ? String(nameRaw).trim() : "";
    const quantity = parseNumber(row[quantityColumn]);
    const soldAt = parseDate(row[dateColumn]);
    const price = priceColumn ? parseNumber(row[priceColumn]) : null;

    if (!name || quantity === null || quantity <= 0 || !soldAt) {
      skippedRows++;
      continue;
    }

    const key = name.toLowerCase();
    let item = itemsByName.get(key);
    if (!item) {
      const { data: created, error: createError } = await supabase
        .from("inventory_items")
        .insert({
          business_id: businessId,
          name,
          category: "Импорт",
          unit: "шт",
          current_stock: 0,
          min_stock: 0,
          desired_stock: 0,
          avg_daily_usage: 0,
        })
        .select()
        .single();
      if (createError || !created) {
        skippedRows++;
        continue;
      }
      item = created as InventoryItem;
      itemsByName.set(key, item);
      createdProductNames.push(name);
    }

    const list = newSalesByProductId.get(item.id) ?? [];
    list.push({ quantity, unit_price: price, sold_at: soldAt });
    newSalesByProductId.set(item.id, list);
  }

  let insertedSales = 0;
  const productsSummary: { id: string; name: string; insertedSales: number }[] = [];

  for (const [productId, salesToInsert] of newSalesByProductId.entries()) {
    const payload = salesToInsert.map((s) => ({
      business_id: businessId,
      product_id: productId,
      quantity: s.quantity,
      unit_price: s.unit_price,
      total_amount: s.unit_price !== null ? s.unit_price * s.quantity : null,
      sold_at: s.sold_at,
      source: "excel_import" as const,
    }));

    const { error: insertError } = await supabase.from("sales").insert(payload);
    if (insertError) continue;
    insertedSales += payload.length;

    // Пересчитываем метрики товара из ВСЕЙ его истории продаж (не только
    // только что импортированных строк), чтобы forecast_daily_usage и
    // days_of_stock отражали реальную полную картину.
    const { data: allSales } = await supabase
      .from("sales")
      .select("sold_at, quantity")
      .eq("product_id", productId);

    const item = Array.from(itemsByName.values()).find((i) => i.id === productId)!;
    const metrics = computeProductMetrics((allSales as Pick<Sale, "sold_at" | "quantity">[]) ?? [], {
      currentStock: item.current_stock,
      minStock: item.min_stock,
      desiredStock: item.desired_stock,
    });

    await supabase
      .from("inventory_items")
      .update({
        forecast_daily_usage: metrics.averageDailyUsage,
        days_of_stock: metrics.daysOfStock,
        last_purchase_at: metrics.lastSaleAt,
      })
      .eq("id", productId);

    productsSummary.push({ id: productId, name: item.name, insertedSales: payload.length });
  }

  return NextResponse.json({
    insertedSales,
    skippedRows,
    createdProducts: createdProductNames,
    products: productsSummary,
  });
}
