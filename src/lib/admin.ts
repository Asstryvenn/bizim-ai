import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { AdminDailyPoint } from "@/types";

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Не авторизован");
    this.name = "NotAuthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Доступ запрещён");
    this.name = "ForbiddenError";
  }
}

const ADMIN_EMAIL = "athenahubglobal@gmail.com"; // <-- сюда поставь свой email

export async function requireAdmin(): Promise<{ user: User }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new NotAuthenticatedError();
  }

  // Проверяем только email
  if (user.email !== ADMIN_EMAIL) {
    throw new ForbiddenError();
  }

  return { user };
}

/**
 * Сервисный клиент для admin-операций
 */
export function adminServiceClient() {
  return createServiceRoleClient();
}

/**
 * Строит временной ряд "количество записей по дням" за последние `days` дней
 * (включая сегодня) из массива ISO-таймстампов. Используется для графиков
 * регистраций и AI-анализов в Admin Overview — период 7/30/90 дней
 * переключается на клиенте нарезкой этого же массива, поэтому здесь всегда
 * считаем максимальный период (90 дней).
 */
export function buildDailySeries(timestamps: (string | null | undefined)[], days = 90): AdminDailyPoint[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    if (!ts) continue;
    const key = new Date(ts).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series: AdminDailyPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return series;
}