"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { AdminUserRow, AdminBusinessRow } from "@/types";
import i18n from "@/lib/i18n";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadWorkbook(rows: Record<string, unknown>[], sheetName: string, fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

export function ExportUsersButton({ users }: { users: AdminUserRow[] }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    setBusy(true);
    try {
      const rows = users.map((u) => ({
        Email: u.email,
        Business: u.business_name ?? "",
        City: u.city ?? "",
        Role: u.role,
        "Created At": formatDate(u.created_at),
        "Last Login": formatDate(u.last_sign_in_at),
        "Analyses Count": u.analyses_count,
      }));
      downloadWorkbook(rows, "Users", `bizim-users-${Date.now()}.xlsx`);
      toast.success(t("admin.export.success"));
    } catch {
      toast.error(t("admin.export.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={handleExport} disabled={busy} className="btn-secondary text-sm py-2 px-4">
      {busy ? t("admin.export.exporting") : `⬇️ ${t("admin.export.exportUsers")}`}
    </button>
  );
}

export function ExportBusinessesButton({ businesses }: { businesses: AdminBusinessRow[] }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    setBusy(true);
    try {
      const rows = businesses.map((b) => ({
        Name: b.business_name,
        City: b.city,
        Owner: b.email ?? "",
        "Registration Date": formatDate(b.created_at),
        "Analyses Count": b.analyses_count,
        "Growth Tools Count": b.growth_tools_count,
      }));
      downloadWorkbook(rows, "Businesses", `bizim-businesses-${Date.now()}.xlsx`);
      toast.success(t("admin.export.success"));
    } catch {
      toast.error(t("admin.export.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={handleExport} disabled={busy} className="btn-secondary text-sm py-2 px-4">
      {busy ? t("admin.export.exporting") : `⬇️ ${t("admin.export.exportBusinesses")}`}
    </button>
  );
}
