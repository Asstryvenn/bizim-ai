"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { loginSchema, type LoginSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchema>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginSchema) => {
    setServerError(null);
    setSubmitting(true);

    let supabase;
    try {
      supabase = createClient();
    } catch (e) {
      setServerError((e as Error).message);
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError(error.message);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-mist flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Bizim
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("auth.login.title")}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="card mt-8 space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" {...register("email")} />
            {errors.email && (
              <p className="text-danger text-xs mt-1">{t(errors.email.message ?? "")}</p>
            )}
          </div>
          <div>
            <label className="label">{t("auth.password")}</label>
            <input type="password" className="input" {...register("password")} />
            {errors.password && (
              <p className="text-danger text-xs mt-1">{t(errors.password.message ?? "")}</p>
            )}
          </div>

          {serverError && (
            <p className="text-danger text-sm badge-danger rounded-lg px-4 py-3">
              {serverError}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t("auth.login.submitting") : t("auth.login.submit")}
          </button>

          <p className="text-sm text-ink/50 text-center">
            {t("auth.login.noAccount")}{" "}
            <Link href="/register" className="text-accent font-medium">
              {t("auth.login.registerLink")}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
