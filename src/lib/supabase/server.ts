import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Клиент Supabase для использования на сервере (server components, route handlers).
 * Работает через cookies текущего запроса, поэтому RLS применяется от имени
 * реального залогиненного пользователя.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase не настроен: заполните NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local"
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // set() может падать в server components без middleware — это нормально
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // игнорируем — актуально только внутри route handlers/middleware
        }
      },
    },
  });
}

/**
 * Клиент с Service Role ключом — используется ТОЛЬКО в API routes,
 * когда нужно писать данные в обход RLS от имени системы
 * (например при импорте больших файлов). Никогда не импортировать
 * этот файл в client components.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY не задан — добавьте его в .env.local (см. .env.example)"
    );
  }

  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
