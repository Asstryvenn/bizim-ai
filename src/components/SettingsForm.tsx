"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { settingsSchema, type SettingsSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/types";

interface SettingsFormProps {
  business: Business;
  email: string;
}

export default function SettingsForm({ business, email }: SettingsFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsSchema>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      firstName: business.first_name ?? "",
      lastName: business.last_name ?? "",
      businessName: business.business_name ?? "",
    },
  });

  const onSubmit = async (values: SettingsSchema) => {
    setSaving(true);
    try {
      const supabase = createClient();

      const { error: businessError } = await supabase
        .from("businesses")
        .update({
          first_name: values.firstName,
          last_name: values.lastName,
          business_name: values.businessName,
        })
        .eq("id", business.id);

      if (businessError) throw new Error(businessError.message);

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: values.firstName,
          last_name: values.lastName,
        },
      });

      if (authError) throw new Error(authError.message);

      toast.success(t("settings.saved"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        <h2 className="font-semibold tracking-tight">{t("settings.personalTitle")}</h2>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="label">{t("settings.firstName")}</label>
            <input className="input" {...register("firstName")} />
            {errors.firstName && <p className="text-xs text-danger mt-1">{t(errors.firstName.message ?? "")}</p>}
          </div>
          <div>
            <label className="label">{t("settings.lastName")}</label>
            <input className="input" {...register("lastName")} />
            {errors.lastName && <p className="text-xs text-danger mt-1">{t(errors.lastName.message ?? "")}</p>}
          </div>
        </div>

        <div>
          <label className="label">{t("settings.email")}</label>
          <input className="input opacity-60 cursor-not-allowed" value={email} disabled readOnly />
          <p className="text-xs text-ink/40 mt-1">{t("settings.emailHint")}</p>
        </div>

        <div>
          <label className="label">{t("settings.businessName")}</label>
          <input className="input" {...register("businessName")} />
          {errors.businessName && (
            <p className="text-xs text-danger mt-1">{t(errors.businessName.message ?? "")}</p>
          )}
        </div>

        <div className="pt-2">
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? t("settings.saving") : t("settings.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
