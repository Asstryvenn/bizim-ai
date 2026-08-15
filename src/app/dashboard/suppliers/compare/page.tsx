import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import { fetchOrdersWithSuppliers } from "@/lib/ordersData";
import { scoreSuppliers } from "@/lib/supplyChain";
import type { Business, Supplier } from "@/types";

function fmt(n: number | null, suffix = ""): string {
  return n === null ? "—" : `${Math.round(n * 100) / 100}${suffix}`;
}

export default async function SupplierComparePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("*").eq("user_id", user.id).single();
  if (!business) redirect("/register");
  const typedBusiness = business as Business;

  const { data: suppliersData } = await supabase
    .from("suppliers")
    .select("*")
    .eq("business_id", typedBusiness.id);
  const suppliers = (suppliersData as Supplier[]) ?? [];
  const orders = await fetchOrdersWithSuppliers(supabase, typedBusiness.id, suppliers);
  const scores = scoreSuppliers(suppliers, orders);

  const bestPriceId =
    suppliers.filter((s) => s.price_index !== null).length > 0
      ? suppliers.reduce((best, s) =>
          s.price_index !== null && (best.price_index === null || s.price_index < best.price_index)
            ? s
            : best
        ).id
      : null;
  const bestSpeedId =
    scores.filter((s) => s.metrics.avgDeliveryDays !== null).length > 0
      ? scores.reduce((best, s) =>
          s.metrics.avgDeliveryDays !== null &&
          (best.metrics.avgDeliveryDays === null || s.metrics.avgDeliveryDays < best.metrics.avgDeliveryDays)
            ? s
            : best
        ).supplier.id
      : null;
  const bestReliabilityId =
    scores.filter((s) => s.reliabilityScore !== null).length > 0
      ? scores.reduce((best, s) =>
          s.reliabilityScore !== null && (best.reliabilityScore === null || s.reliabilityScore > best.reliabilityScore)
            ? s
            : best
        ).supplier.id
      : null;

  return (
    <main className="min-h-screen bg-mist">
      <DashboardNav
        businessName={typedBusiness.business_name}
        isAdmin={typedBusiness.role === "admin"}
        firstName={typedBusiness.first_name}
        lastName={typedBusiness.last_name}
        email={user.email ?? ""}
      />
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Сравнение поставщиков</h1>
          <p className="text-sm text-ink/50 mt-1">
            Показатели скорости и надёжности считаются из реальных заказов. Прочерк — данных пока недостаточно.
          </p>
        </div>

        {suppliers.length === 0 ? (
          <div className="card text-sm text-ink/50">Пока нет ни одного поставщика.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink/50">
                  <th className="px-4 py-3 font-medium">Поставщик</th>
                  <th className="px-4 py-3 font-medium">Ценовой индекс</th>
                  <th className="px-4 py-3 font-medium">Заказов</th>
                  <th className="px-4 py-3 font-medium">Доставлено</th>
                  <th className="px-4 py-3 font-medium">Средний срок доставки</th>
                  <th className="px-4 py-3 font-medium">Надёжность</th>
                </tr>
              </thead>
              <tbody>
                {scores.map(({ supplier, metrics, reliabilityScore }) => (
                  <tr key={supplier.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{supplier.name}</td>
                    <td className="px-4 py-3">
                      {fmt(supplier.price_index)}
                      {supplier.id === bestPriceId && (
                        <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          лучшая цена
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{metrics.ordersCount}</td>
                    <td className="px-4 py-3">{metrics.deliveredCount}</td>
                    <td className="px-4 py-3">
                      {fmt(metrics.avgDeliveryDays, " дн.")}
                      {supplier.id === bestSpeedId && (
                        <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          быстрее всех
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {fmt(reliabilityScore, "%")}
                      {supplier.id === bestReliabilityId && (
                        <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          надёжнее всех
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
