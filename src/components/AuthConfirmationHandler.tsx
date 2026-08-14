"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Fallback for Supabase email confirmation links that land here with tokens
// in the URL hash (#access_token=...&type=signup) instead of hitting
// /auth/callback with a PKCE ?code=. This happens whenever the Supabase
// project's Redirect URL allow-list contains only the bare site origin —
// the hash fragment never reaches the server, so it has to be picked up
// client-side, on whatever page Supabase redirected to (the site root).
// Establishes the session, then creates the business profile via the same
// idempotent route used by /auth/callback and /register (see
// src/lib/registration.ts) — nothing here bypasses RLS or duplicates logic.
export default function AuthConfirmationHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!window.location.hash.includes("access_token")) return;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (!accessToken || !refreshToken || type !== "signup") return;

    let supabase;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(async ({ error }) => {
      // Токены не должны оставаться в адресной строке независимо от результата.
      window.history.replaceState(null, "", window.location.pathname);
      if (error) return;
      await fetch("/api/auth/register-business", { method: "POST" }).catch(() => null);
      router.push("/dashboard");
      router.refresh();
    });
  }, [router]);

  return null;
}
