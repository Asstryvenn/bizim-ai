import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureBusinessProfile } from "@/lib/registration";

// Supabase email confirmation (PKCE) редиректит сюда с ?code=... —
// @supabase/ssr сохраняет code_verifier в cookie при signUp(), и
// exchangeCodeForSession обменивает code на настоящую сессию, записывая
// auth-cookies через тот же server client (см. src/lib/supabase/server.ts).
// После этого гарантированно создаём business profile из данных
// регистрации, сохранённых в user_metadata — раньше этот шаг не выполнялся
// вообще, из-за чего после подтверждения email оставался только auth user
// без записи в businesses.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      try {
        await ensureBusinessProfile(supabase, data.user);
      } catch {
        // Не блокируем вход пользователя, если профиль не удалось создать
        // автоматически (например, метаданных не было) — dashboard в этом
        // случае сам покажет понятное "профиль не найден" и повторит попытку.
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
