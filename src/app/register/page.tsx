"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { registerSchema, type RegisterSchema, BUSINESS_TYPES } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // undefined = ещё проверяем сессию, null = гостя, string = email залогиненного пользователя
  const [existingUserEmail, setExistingUserEmail] = useState<string | null | undefined>(undefined);
  const [signingOut, setSigningOut] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      // Supabase не настроен — форма сама покажет ошибку при сабмите.
      setExistingUserEmail(null);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setExistingUserEmail(data.user?.email ?? null);
    });
  }, []);

  const handleSignOutAndRegister = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setExistingUserEmail(null);
    } finally {
      setSigningOut(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      employeesCount: 0,
      clientsToday: 0,
      clientsWeek: 0,
      clientsMonth: 0,
      clientsYear: 0,
      averageCheck: 0,
    },
  });

  const onSubmit = async (values: RegisterSchema) => {
    setServerError(null);
    setSubmitting(true);

    let supabase;
    try {
      supabase = createClient();
    } catch (e) {
      setServerError((e as Error).message || t("auth.register.supabaseNotConfigured"));
      setSubmitting(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { first_name: values.firstName, last_name: values.lastName },
      },
    });

    if (authError) {
      setServerError(authError.message);
      setSubmitting(false);
      return;
    }

    // Если в проекте включено подтверждение email, signUp() создаёт пользователя,
    // но НЕ выдаёт активную сессию (authData.session === null) — тогда следующий
    // insert в businesses упадёт из-за RLS (auth.uid() ещё не установлен). Раньше
    // код этого не проверял и просто пытался вставить бизнес, получая невнятную
    // ошибку вместо понятного "проверьте почту".
    if (!authData.session) {
      setPendingConfirmationEmail(values.email);
      setSubmitting(false);
      return;
    }

    const userId = authData.user!.id;

    const { error: insertError } = await supabase.from("businesses").insert({
      user_id: userId,
      first_name: values.firstName,
      last_name: values.lastName,
      business_name: values.businessName,
      business_type: values.businessType,
      city: values.city,
      employees_count: values.employeesCount,
      average_check: values.averageCheck,
      work_hours_from: values.workHoursFrom,
      work_hours_to: values.workHoursTo,
      peak_hours: values.peakHours,
      main_problem: values.mainProblem,
      clients_today: values.clientsToday,
      clients_week: values.clientsWeek,
      clients_month: values.clientsMonth,
      clients_year: values.clientsYear,
    });

    if (insertError) {
      setServerError(insertError.message);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  // Ещё не знаем, залогинен ли человек — не показываем форму, чтобы не мигать.
  if (existingUserEmail === undefined) {
    return <main className="min-h-screen bg-mist" />;
  }

  if (existingUserEmail) {
    return (
      <main className="min-h-screen bg-mist flex items-center justify-center px-6">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold">{t("auth.register.alreadyLoggedInTitle")}</h1>
          <p className="text-sm text-ink/60 mt-2">{existingUserEmail}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/dashboard" className="btn-primary">
              {t("auth.register.goToDashboard")}
            </Link>
            <button
              onClick={handleSignOutAndRegister}
              disabled={signingOut}
              className="btn-secondary"
            >
              {signingOut ? t("auth.register.signingOut") : t("auth.register.signOutAndRegister")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (pendingConfirmationEmail) {
    return (
      <main className="min-h-screen bg-mist flex items-center justify-center px-6">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold">{t("auth.register.checkEmailTitle")}</h1>
          <p className="text-sm text-ink/60 mt-2">
            {t("auth.register.checkEmailDescription", { email: pendingConfirmationEmail })}
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-flex">
            {t("auth.register.goToLogin")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mist py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Bizim
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("auth.register.title")}</h1>
        <p className="mt-2 text-ink/60">{t("auth.register.subtitle")}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="card mt-8 space-y-8">
          <section className="space-y-4">
            <h2 className="font-semibold text-ink/80">{t("auth.register.sections.personal")}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t("auth.firstName")}</label>
                <input className="input" {...register("firstName")} />
                {errors.firstName && (
                  <p className="text-danger text-xs mt-1">{t(errors.firstName.message ?? "")}</p>
                )}
              </div>
              <div>
                <label className="label">{t("auth.lastName")}</label>
                <input className="input" {...register("lastName")} />
                {errors.lastName && (
                  <p className="text-danger text-xs mt-1">{t(errors.lastName.message ?? "")}</p>
                )}
              </div>
            </div>
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
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold text-ink/80">{t("auth.register.sections.business")}</h2>
            <div>
              <label className="label">{t("auth.businessName")}</label>
              <input className="input" {...register("businessName")} />
              {errors.businessName && (
                <p className="text-danger text-xs mt-1">{t(errors.businessName.message ?? "")}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t("auth.register.businessType")}</label>
                <select className="input" {...register("businessType")}>
                  <option value="">{t("auth.register.chooseOption")}</option>
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt.value} value={bt.value}>
                      {t(bt.labelKey)}
                    </option>
                  ))}
                </select>
                {errors.businessType && (
                  <p className="text-danger text-xs mt-1">{t(errors.businessType.message ?? "")}</p>
                )}
              </div>
              <div>
                <label className="label">{t("auth.register.city")}</label>
                <input className="input" {...register("city")} />
                {errors.city && (
                  <p className="text-danger text-xs mt-1">{t(errors.city.message ?? "")}</p>
                )}
              </div>
            </div>
            <div>
              <label className="label">{t("auth.register.employeesCount")}</label>
              <input type="number" className="input" {...register("employeesCount")} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold text-ink/80">{t("auth.register.sections.clients")}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t("auth.register.clientsToday")}</label>
                <input type="number" className="input" {...register("clientsToday")} />
              </div>
              <div>
                <label className="label">{t("auth.register.clientsWeek")}</label>
                <input type="number" className="input" {...register("clientsWeek")} />
              </div>
              <div>
                <label className="label">{t("auth.register.clientsMonth")}</label>
                <input type="number" className="input" {...register("clientsMonth")} />
              </div>
              <div>
                <label className="label">{t("auth.register.clientsYear")}</label>
                <input type="number" className="input" {...register("clientsYear")} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold text-ink/80">{t("auth.register.sections.operational")}</h2>
            <div>
              <label className="label">{t("auth.register.mainProblem")}</label>
              <textarea className="input" rows={3} {...register("mainProblem")} />
            </div>
            <div>
              <label className="label">{t("auth.register.averageCheck")}</label>
              <input type="number" step="0.01" className="input" {...register("averageCheck")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t("auth.register.workHoursFrom")}</label>
                <input type="time" className="input" {...register("workHoursFrom")} />
                {errors.workHoursFrom && (
                  <p className="text-danger text-xs mt-1">{t(errors.workHoursFrom.message ?? "")}</p>
                )}
              </div>
              <div>
                <label className="label">{t("auth.register.workHoursTo")}</label>
                <input type="time" className="input" {...register("workHoursTo")} />
                {errors.workHoursTo && (
                  <p className="text-danger text-xs mt-1">{t(errors.workHoursTo.message ?? "")}</p>
                )}
              </div>
            </div>
            <div>
              <label className="label">{t("auth.register.peakHours")}</label>
              <input
                className="input"
                placeholder={t("auth.register.peakHoursPlaceholder")}
                {...register("peakHours")}
              />
            </div>
          </section>

          {serverError && (
            <p className="text-danger text-sm badge-danger rounded-lg px-4 py-3">
              {serverError}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t("auth.register.submitting") : t("auth.register.submit")}
          </button>

          <p className="text-sm text-ink/50 text-center">
            {t("auth.register.haveAccount")}{" "}
            <Link href="/login" className="text-accent font-medium">
              {t("auth.login.submit")}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
