import type { SupabaseClient, User } from "@supabase/supabase-js";

// Данные бизнеса, введённые на /register, сохраняются в user_metadata
// (options.data при signUp) — это единственное надёжное место, доступное
// как сразу после signUp, так и позже, когда пользователь подтверждает
// email по ссылке (см. src/app/auth/callback/route.ts). React state
// браузера к этому моменту уже недоступен: ссылка может быть открыта в
// другой вкладке, другом браузере или на другом устройстве.
export interface PendingBusinessMetadata {
  first_name?: string;
  last_name?: string;
  business_name?: string;
  business_type?: string;
  city?: string;
  employees_count?: number;
  average_check?: number;
  work_hours_from?: string;
  work_hours_to?: string;
  peak_hours?: string;
  main_problem?: string;
  clients_today?: number;
  clients_week?: number;
  clients_month?: number;
  clients_year?: number;
}

// Postgres unique_violation — гонка между двумя параллельными вызовами
// (например, повторный переход по confirmation-ссылке) уже была разрешена
// другим запросом. Это ожидаемое поведение idempotent-flow, а не ошибка.
const UNIQUE_VIOLATION = "23505";

/**
 * Гарантирует, что для подтверждённого auth-пользователя существует ровно
 * одна запись businesses. Idempotent: повторный вызов для того же
 * пользователя ничего не создаёт повторно (проверка "уже есть?" + unique
 * index businesses_user_id_key как страховка от гонки).
 *
 * Работает через переданный supabase-клиент (с сессией пользователя из
 * cookies) — RLS остаётся включённым, service role не используется.
 * Возвращает null, если профиля ещё нет и создать его нечем (в
 * user_metadata нет данных регистрации, например пользователь создан не
 * через /register).
 */
export async function ensureBusinessProfile(supabase: SupabaseClient, user: User) {
  const { data: existing, error: selectError } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (existing) return existing;

  const meta = (user.user_metadata ?? {}) as PendingBusinessMetadata;
  if (!meta.business_name || !meta.business_type || !meta.city) {
    return null;
  }

  const payload = {
    user_id: user.id,
    first_name: meta.first_name ?? "",
    last_name: meta.last_name ?? "",
    business_name: meta.business_name,
    business_type: meta.business_type,
    city: meta.city,
    employees_count: meta.employees_count ?? 0,
    average_check: meta.average_check ?? 0,
    work_hours_from: meta.work_hours_from ?? null,
    work_hours_to: meta.work_hours_to ?? null,
    peak_hours: meta.peak_hours ?? null,
    main_problem: meta.main_problem ?? null,
    clients_today: meta.clients_today ?? 0,
    clients_week: meta.clients_week ?? 0,
    clients_month: meta.clients_month ?? 0,
    clients_year: meta.clients_year ?? 0,
  };

  const { data: created, error: insertError } = await supabase
    .from("businesses")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (!insertError) return created;

  if ((insertError as { code?: string }).code === UNIQUE_VIOLATION) {
    const { data: winner } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle();
    return winner;
  }

  throw new Error(insertError.message);
}
