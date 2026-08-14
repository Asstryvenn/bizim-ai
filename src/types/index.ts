export type BusinessType =
  | "cafe"
  | "shop"
  | "salon"
  | "pharmacy"
  | "carwash"
  | "other";

export interface Business {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  business_name: string;
  business_type: string;
  city: string;
  employees_count: number;
  clients_today: number;
  clients_week: number;
  clients_month: number;
  clients_year: number;
  main_problem: string | null;
  average_check: number;
  work_hours_from: string | null;
  work_hours_to: string | null;
  peak_hours: string | null;
  last_analysis: string | null;
  last_analysis_at: string | null;
  role?: "admin" | "user";
  updated_at: string;
  created_at: string;
}

export interface RegisterFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  businessName: string;
  businessType: string;
  city: string;
  employeesCount: number;
  clientsToday: number;
  clientsWeek: number;
  clientsMonth: number;
  clientsYear: number;
  mainProblem: string;
  averageCheck: number;
  workHoursFrom: string;
  workHoursTo: string;
  peakHours: string;
}

export type ParsedRow = Record<string, string | number | null>;

export interface ImportedFile {
  id: string;
  business_id: string;
  file_name: string;
  file_type: "csv" | "xlsx" | "json";
  row_count: number;
  parsed_data: ParsedRow[];
  created_at: string;
}

export interface AiAnalysis {
  id: string;
  business_id: string;
  source_file_id: string | null;
  report: string;
  raw_stats: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  created_at: string;
  conversation_id?: string | null;
}

// ---------- AI Chat: диалоги (история чатов) ----------

export interface ChatConversation {
  id: string;
  business_id: string;
  title: string;
  pinned: boolean;
  share_id: string | null;
  shared: boolean;
  updated_at: string;
  created_at: string;
}

// ---------- AI-инструменты для развития бизнеса ----------

export type GrowthToolType =
  | "promo"
  | "instagram_post"
  | "tiktok_script"
  | "loyalty_program"
  | "coupon"
  | "sms"
  | "profit_tips";

export interface GrowthToolSection {
  label: string;
  content: string;
}

// Единый формат для любого сгенерированного инструмента —
// упрощает и рендер на фронтенде, и парсинг ответа OpenAI.
export interface GrowthToolContent {
  title: string;
  sections: GrowthToolSection[];
}

export interface GrowthToolResult {
  id: string;
  business_id: string;
  analysis_id: string | null;
  tool_type: GrowthToolType;
  title: string;
  content: GrowthToolContent;
  created_at: string;
}

// ---------- Подписки / paywall ----------

export type PlanId = "starter" | "growth" | "pro";

export type SubscriptionStatus = "inactive" | "active" | "canceled" | "past_due";

// "demo" — единственный реальный провайдер сейчас (см. DemoPaymentService).
// Остальные значения зарезервированы под будущую интеграцию.
export type PaymentProvider = "demo" | "kaspi" | "paypal" | "card" | "bank";

export interface Subscription {
  id: string;
  business_id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  updated_at: string;
  created_at: string;
}

// ---------- Admin Panel ----------

export type UserRole = "admin" | "user";

// Строка таблицы пользователей в Admin Panel — объединяет данные
// auth.users (email, даты) с их бизнесом (business_id нужен для действий).
export interface AdminUserRow {
  user_id: string;
  business_id: string | null;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  business_name: string | null;
  city: string | null;
  role: UserRole;
  analyses_count: number;
}

export interface AdminBusinessRow extends Business {
  email?: string | null;
  analyses_count: number;
  growth_tools_count: number;
}

export interface AdminAnalysisRow extends AiAnalysis {
  business_name: string | null;
}

export interface AdminGrowthToolRow extends GrowthToolResult {
  business_name: string | null;
}

export interface AdminStats {
  usersCount: number;
  businessesCount: number;
  analysesCount: number;
  growthToolsCount: number;
  registeredToday: number;
  activeUsers7d: number;
}

// Точка временного ряда для графиков Admin Overview (регистрации / анализы по дням).
export interface AdminDailyPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

// Строка блока "Top Businesses" в Dashboard Overview.
export interface AdminTopBusiness {
  id: string;
  business_name: string;
  analyses_count: number;
  growth_tools_count: number;
  last_activity: string | null;
}

// ---------- Снабжение и логистика (SERPIN BUSINESS TOURNAMENT) ----------

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  category: string;
  price_index: number;
  avg_delivery_days: number;
  delay_rate: number;
  orders_count: number;
  updated_at: string;
  created_at: string;
}

export type InventoryStatus = "ok" | "low" | "critical" | "excess";

export interface InventoryItem {
  id: string;
  business_id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  desired_stock: number;
  avg_daily_usage: number;
  supplier_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface InventoryItemWithSupplier extends InventoryItem {
  supplier: Supplier | null;
}

export type OrderStatus = "draft" | "sent" | "confirmed" | "in_transit" | "delivered" | "delayed";

export interface PurchaseOrder {
  id: string;
  business_id: string;
  supplier_id: string;
  status: OrderStatus;
  total_amount: number;
  expected_delivery: string | null;
  actual_delivery: string | null;
  updated_at: string;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  order_id: string;
  inventory_item_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  supplier: Supplier | null;
  items: (PurchaseOrderItem & { item: InventoryItem | null })[];
}

export interface ActivityLogEntry {
  id: string;
  business_id: string;
  action: string;
  description: string;
  created_at: string;
}

export interface BusinessTool {
  id: string;
  business_id: string;
  tool_key: string;
  is_favorite: boolean;
  is_active: boolean;
  updated_at: string;
  created_at: string;
}

export type ToolCategory = "Склад" | "Закупки" | "Поставщики" | "Аналитика" | "Уведомления";

export interface ToolDefinition {
  key: string;
  title: string;
  description: string;
  category: ToolCategory;
  href: string;
  icon: string;
}
