import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildStructuredAnalysis } from "@/lib/aiAnalysis";
import type { Business, InventoryItem, PurchaseOrderWithDetails, Sale, Supplier } from "@/types";

// Возвращает structured JSON { summary, insights, risks, recommendations,
// actions } для текущего (и только текущего) бизнеса пользователя.
// Все числа в ответе получены из get_inventory/get_sales-эквивалентов ниже —
// AI-слой (buildStructuredAnalysis) их не изобретает, только интерпретирует.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: business } = await supabase.from("businesses").select("*").eq("user_id", user.id).single();
  if (!business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }
  const typedBusiness = business as Business;

  const [{ data: items }, { data: sales }, { data: suppliers }, { data: ordersData }] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("business_id", typedBusiness.id),
    supabase.from("sales").select("*").eq("business_id", typedBusiness.id),
    supabase.from("suppliers").select("*").eq("business_id", typedBusiness.id),
    supabase.from("purchase_orders").select("*").eq("business_id", typedBusiness.id),
  ]);

  const salesByProduct = new Map<string, Sale[]>();
  for (const sale of (sales as Sale[]) ?? []) {
    const list = salesByProduct.get(sale.product_id) ?? [];
    list.push(sale);
    salesByProduct.set(sale.product_id, list);
  }

  const supplierById = new Map(((suppliers as Supplier[]) ?? []).map((s) => [s.id, s]));
  const orders: PurchaseOrderWithDetails[] = ((ordersData ?? []) as PurchaseOrderWithDetails[]).map((o) => ({
    ...o,
    supplier: supplierById.get(o.supplier_id) ?? null,
    items: [],
  }));

  const analysis = buildStructuredAnalysis(
    typedBusiness,
    (items as InventoryItem[]) ?? [],
    salesByProduct,
    (suppliers as Supplier[]) ?? [],
    orders
  );

  return NextResponse.json(analysis);
}
