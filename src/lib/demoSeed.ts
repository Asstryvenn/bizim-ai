import type { SupabaseClient } from "@supabase/supabase-js";

// Реалистичный, взаимосвязанный демо-набор для кофейни: товар → поставщик →
// заказ → доставка → остаток → прогноз → рекомендация. Запускается один раз,
// когда у бизнеса ещё нет ни одного товара — чтобы после регистрации
// пользователь сразу видел рабочий сценарий, а не пустые экраны.
export async function seedDemoSupplyChain(supabase: SupabaseClient, businessId: string) {
  const suppliersInput = [
    { name: "Fresh Supply", category: "Молочные продукты", price_index: 100, avg_delivery_days: 1, delay_rate: 0.04, orders_count: 12 },
    { name: "Arman Foods", category: "Продукты", price_index: 92, avg_delivery_days: 3, delay_rate: 0.6, orders_count: 5 },
    { name: "City Wholesale", category: "Упаковка", price_index: 105, avg_delivery_days: 2, delay_rate: 0.11, orders_count: 9 },
    { name: "Coffee Pro", category: "Кофе", price_index: 98, avg_delivery_days: 2, delay_rate: 0.1, orders_count: 7 },
  ].map((s) => ({ ...s, business_id: businessId }));

  const { data: suppliers, error: suppliersError } = await supabase
    .from("suppliers")
    .insert(suppliersInput)
    .select();
  if (suppliersError || !suppliers) return;

  const supplierByName = new Map<string, { id: string; name: string }>(
    suppliers.map((s: { id: string; name: string }) => [s.name, s])
  );

  const itemsInput = [
    { name: "Молоко 3.2%", category: "Молочные продукты", unit: "л", current_stock: 12, min_stock: 20, desired_stock: 40, avg_daily_usage: 8, supplier: "Fresh Supply" },
    { name: "Кофейные зёрна", category: "Кофе", unit: "кг", current_stock: 15, min_stock: 5, desired_stock: 20, avg_daily_usage: 2, supplier: "Coffee Pro" },
    { name: "Стаканы 300 мл", category: "Упаковка", unit: "шт", current_stock: 150, min_stock: 200, desired_stock: 600, avg_daily_usage: 80, supplier: "City Wholesale" },
    { name: "Крышки", category: "Упаковка", unit: "шт", current_stock: 500, min_stock: 200, desired_stock: 600, avg_daily_usage: 75, supplier: "City Wholesale" },
    { name: "Сироп ванильный", category: "Сиропы", unit: "л", current_stock: 18, min_stock: 3, desired_stock: 6, avg_daily_usage: 0.58, supplier: "Arman Foods" },
    { name: "Сироп карамельный", category: "Сиропы", unit: "л", current_stock: 6, min_stock: 3, desired_stock: 6, avg_daily_usage: 1, supplier: "Arman Foods" },
    { name: "Сахар", category: "Продукты", unit: "кг", current_stock: 20, min_stock: 8, desired_stock: 25, avg_daily_usage: 1.5, supplier: "Fresh Supply" },
    { name: "Овсяное молоко", category: "Молочные продукты", unit: "л", current_stock: 5, min_stock: 6, desired_stock: 15, avg_daily_usage: 2, supplier: "Fresh Supply" },
    { name: "Вода", category: "Напитки", unit: "л", current_stock: 40, min_stock: 10, desired_stock: 20, avg_daily_usage: 3, supplier: "City Wholesale" },
  ].map(({ supplier, ...item }) => ({
    ...item,
    business_id: businessId,
    supplier_id: supplierByName.get(supplier)?.id ?? null,
  }));

  const { data: items, error: itemsError } = await supabase.from("inventory_items").insert(itemsInput).select();
  if (itemsError || !items) return;

  const itemByName = new Map<string, { id: string; name: string }>(
    items.map((i: { id: string; name: string }) => [i.name, i])
  );
  const freshSupply = supplierByName.get("Fresh Supply");
  const armanFoods = supplierByName.get("Arman Foods");
  const cityWholesale = supplierByName.get("City Wholesale");
  const milk = itemByName.get("Молоко 3.2%");
  const cups = itemByName.get("Стаканы 300 мл");
  const caramelSyrup = itemByName.get("Сироп карамельный");

  const today = Date.now();
  const day = 86400000;

  const ordersInput: { supplier: unknown; status: string; total_amount: number; expected_delivery: string; actual_delivery: string | null }[] = [];
  if (freshSupply && milk) {
    ordersInput.push({
      supplier: freshSupply,
      status: "in_transit",
      total_amount: 4000,
      expected_delivery: new Date(today + day).toISOString().slice(0, 10),
      actual_delivery: null,
    });
  }
  if (cityWholesale && cups) {
    ordersInput.push({
      supplier: cityWholesale,
      status: "delivered",
      total_amount: 21000,
      expected_delivery: new Date(today - day).toISOString().slice(0, 10),
      actual_delivery: new Date(today - day).toISOString().slice(0, 10),
    });
  }
  if (armanFoods && caramelSyrup) {
    ordersInput.push({
      supplier: armanFoods,
      status: "delayed",
      total_amount: 5520,
      expected_delivery: new Date(today - 2 * day).toISOString().slice(0, 10),
      actual_delivery: null,
    });
  }

  for (const [i, orderInput] of ordersInput.entries()) {
    const supplier = orderInput.supplier as { id: string };
    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .insert({
        business_id: businessId,
        supplier_id: supplier.id,
        status: orderInput.status,
        total_amount: orderInput.total_amount,
        expected_delivery: orderInput.expected_delivery,
        actual_delivery: orderInput.actual_delivery,
      })
      .select()
      .single();
    if (orderError || !order) continue;

    const relatedItem = [milk, cups, caramelSyrup][i];
    if (relatedItem) {
      await supabase.from("purchase_order_items").insert({
        order_id: order.id,
        inventory_item_id: relatedItem.id,
        quantity: i === 0 ? 40 : i === 1 ? 300 : 6,
        unit_price: orderInput.total_amount / (i === 0 ? 40 : i === 1 ? 300 : 6),
      });
    }
  }

  await supabase.from("activity_log").insert([
    { business_id: businessId, action: "demo_seed", description: "Загружены демо-данные снабжения (кофейня)" },
  ]);
}
