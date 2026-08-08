import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Если Supabase ещё не настроен — не блокируем разработку,
  // просто пропускаем запрос (страницы сами покажут понятное сообщение).
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      // ВАЖНО (официальный паттерн @supabase/ssr для middleware): при
      // обновлении токена нужно писать cookie не только в response, но и
      // синхронизировать request.cookies и пересоздавать response ИЗ
      // обновлённого request — иначе request.headers, которые уходят дальше
      // в Server Components этого же запроса, продолжают нести старое
      // значение cookie. Раньше это не делалось: set/remove писали только в
      // response.cookies, из-за чего Server Components (server.ts, через
      // next/headers) видели протухшую сессию, сами пытались её обновить
      // при каждом рендере (и эти попытки молча проваливались — в Server
      // Components куки ставить нельзя), провоцируя повторные refresh на
      // каждый запрос.
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /register намеренно НЕ входит в isAuthRoute: раньше middleware принудительно
  // редиректил уже залогиненного пользователя с /register на /dashboard, из-за
  // чего страница регистрации была недоступна тем, кто хочет завести новый
  // аккаунт. Теперь /register сама решает, что показать залогиненному
  // пользователю (см. src/app/register/page.tsx) — middleware её не трогает,
  // но остаётся в matcher ниже, чтобы обновлять auth-куки при заходе на неё.
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/admin");

  // ВАЖНО: если getUser() выше обновил токен, актуальные Set-Cookie уже
  // накоплены в `response`. NextResponse.redirect() создаёт СОВЕРШЕННО НОВЫЙ
  // объект ответа — раньше эти обновлённые куки при редиректе терялись
  // молча (браузер их просто не получал), и сессия на следующем запросе
  // опять выглядела протухшей. Теперь любой редирект переносит cookies
  // из уже собранного `response`.
  if (!user && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (user && isAuthRoute) {
    const dashboardUrl = new URL("/dashboard", request.url);
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
};
