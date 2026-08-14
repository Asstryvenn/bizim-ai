import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardView from "@/components/DashboardView";
import BusinessNotFound from "@/components/BusinessNotFound";
import type { Business, ImportedFile, InventoryItem, PurchaseOrderWithDetails, Supplier } from "@/types";
import { computeStats } from "@/lib/analytics";
import { getPaymentService } from "@/lib/subscription/paymentService";
import { ensureBusinessProfile } from "@/lib/registration";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Защитный fallback: обычно businesses создаётся в /auth/callback сразу
  // после подтверждения email. Но email-клиенты и security-сканеры иногда
  // сами открывают confirmation-ссылку раньше пользователя (тратя
  // одноразовый PKCE code) — тогда callback либо не отработал, либо
  // сработал без реальной сессии пользователя. Если данные регистрации
  // всё ещё есть в user_metadata, пробуем создать профиль и здесь, прежде
  // чем показывать "профиль не найден".
  let typedBusiness = business as Business | null;
  if (!typedBusiness) {
    const created = await ensureBusinessProfile(supabase, user).catch(() => null);
    typedBusiness = created ? ((await supabase.from("businesses").select("*").eq("id", created.id).single()).data as Business) : null;
  }

  if (!typedBusiness) {
    return <BusinessNotFound />;
  }

  // Загружаем ВЕСЬ список импортированных файлов для ImportPanel
  // (раньше сюда всегда передавался initialFiles={[]}).
  const { data: importedFiles } = await supabase
    .from("imported_files")
    .select("*")
    .eq("business_id", typedBusiness.id)
    .order("created_at", { ascending: false });

  const files = (importedFiles as ImportedFile[]) ?? [];
  const latestFile = files[0];

  const rows = latestFile?.parsed_data ?? [];
  const analytics = computeStats(rows);

  const subscription = await getPaymentService(supabase).getSubscription(typedBusiness.id);

  const [{ data: inventoryItems }, { data: suppliersData }, { data: ordersData }] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("business_id", typedBusiness.id),
    supabase.from("suppliers").select("*").eq("business_id", typedBusiness.id),
    supabase.from("purchase_orders").select("*").eq("business_id", typedBusiness.id),
  ]);

  const suppliers = (suppliersData as Supplier[]) ?? [];
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const orders: PurchaseOrderWithDetails[] = ((ordersData ?? []) as PurchaseOrderWithDetails[]).map((o) => ({
    ...o,
    supplier: supplierById.get(o.supplier_id) ?? null,
    items: [],
  }));

  return (
    <DashboardView
      business={typedBusiness}
      userEmail={user.email ?? ""}
      files={files}
      analytics={analytics}
      subscription={subscription}
      inventoryItems={(inventoryItems as InventoryItem[]) ?? []}
      suppliers={suppliers}
      orders={orders}
    />
  );
}
