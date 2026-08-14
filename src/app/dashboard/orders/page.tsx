import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import OrdersView from "@/components/dashboard/OrdersView";
import type { Business, InventoryItem, PurchaseOrderItem, PurchaseOrderWithDetails, Supplier } from "@/types";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!business) redirect("/register");

  const typedBusiness = business as Business;

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("business_id", typedBusiness.id)
    .order("created_at", { ascending: false });

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("business_id", typedBusiness.id);

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: orderItems } =
    orderIds.length > 0
      ? await supabase.from("purchase_order_items").select("*").in("order_id", orderIds)
      : { data: [] };

  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("business_id", typedBusiness.id);

  const supplierById = new Map(((suppliers as Supplier[]) ?? []).map((s) => [s.id, s]));
  const inventoryById = new Map(((inventoryItems as InventoryItem[]) ?? []).map((i) => [i.id, i]));
  const itemsByOrder = new Map<string, PurchaseOrderItem[]>();
  for (const oi of (orderItems as PurchaseOrderItem[]) ?? []) {
    const list = itemsByOrder.get(oi.order_id) ?? [];
    list.push(oi);
    itemsByOrder.set(oi.order_id, list);
  }

  const ordersWithDetails: PurchaseOrderWithDetails[] = ((orders ?? []) as PurchaseOrderWithDetails[]).map(
    (order) => ({
      ...order,
      supplier: supplierById.get(order.supplier_id) ?? null,
      items: (itemsByOrder.get(order.id) ?? []).map((oi) => ({
        ...oi,
        item: inventoryById.get(oi.inventory_item_id) ?? null,
      })),
    })
  );

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <OrdersView business={typedBusiness} initialOrders={ordersWithDetails} />
    </main>
  );
}
