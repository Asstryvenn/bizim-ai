import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureBusinessProfile } from "@/lib/registration";

// Вызывается из /register сразу после signUp(), когда email confirmation
// отключён и signUp() сразу возвращает активную сессию. Использует
// серверный клиент с cookies текущего запроса — RLS применяется от имени
// самого пользователя (auth.uid() = user_id), service role не нужен.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    const business = await ensureBusinessProfile(supabase, user);
    if (!business) {
      return NextResponse.json(
        { error: "Не хватает данных регистрации для создания профиля бизнеса" },
        { status: 422 }
      );
    }
    return NextResponse.json({ business });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось создать профиль бизнеса" },
      { status: 500 }
    );
  }
}
