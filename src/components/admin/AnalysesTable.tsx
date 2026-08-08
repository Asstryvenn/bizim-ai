"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { AdminAnalysisRow } from "@/types";
import DeleteModal from "./DeleteModal";
import TablePagination from "./TablePagination";
import { useAdminTable } from "@/lib/useAdminTable";
import i18n from "@/lib/i18n";

function formatDate(iso: string) {
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const getSortValue = (a: AdminAnalysisRow, key: string): string | number => {
  switch (key) {
    case "business_name":
      return (a.business_name ?? "").toLowerCase();
    case "created_at":
      return new Date(a.created_at).getTime();
    default:
      return "";
  }
};

const COLUMN_KEYS: { key: string; labelKey: string }[] = [
  { key: "business_name", labelKey: "admin.businessesTable.columns.name" },
  { key: "report", labelKey: "admin.analysesTable.report" },
  { key: "created_at", labelKey: "admin.analysesTable.date" },
];

export default function AnalysesTable({ analyses }: { analyses: AdminAnalysisRow[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminAnalysisRow | null>(null);

  const filtered = useMemo(() => {
    if (!query) return analyses;
    return analyses.filter((a) => (a.business_name ?? "").toLowerCase().includes(query.toLowerCase()));
  }, [analyses, query]);

  const table = useAdminTable(filtered, getSortValue);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/analyses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.analysesTable.errors.deleteFailed"));
      toast.success(t("admin.export.success"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chat.genericErrorShort"));
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  };

  return (
    <div className="card overflow-x-auto">
      <input
        className="input mb-4 md:w-80"
        placeholder={t("admin.analysesTable.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="text-left text-ink/40 text-xs uppercase tracking-wide border-b border-border">
            {COLUMN_KEYS.map((col) => (
              <th key={col.key} className="py-2 pr-4">
                {col.key === "report" ? (
                  t(col.labelKey)
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-ink transition"
                    onClick={() => table.toggleSort(col.key)}
                  >
                    {t(col.labelKey)}
                    {table.sort.key === col.key && (table.sort.direction === "asc" ? "▲" : "▼")}
                  </button>
                )}
              </th>
            ))}
            <th className="py-2 pr-4">{t("admin.usersTable.columns.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {table.paged.map((a) => (
            <tr
              key={a.id}
              className="border-b border-border last:border-0 align-top hover:bg-mist transition-colors"
            >
              <td className="py-2 pr-4 whitespace-nowrap">{a.business_name ?? "—"}</td>
              <td className="py-2 pr-4 max-w-md">
                <p className="line-clamp-2 text-ink/70">{a.report}</p>
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">{formatDate(a.created_at)}</td>
              <td className="py-2 pr-4">
                <button
                  className="text-xs py-1.5 px-3 rounded-xl badge-danger hover:bg-danger/20 disabled:opacity-50 transition"
                  disabled={busyId === a.id}
                  onClick={() => setPendingDelete(a)}
                >
                  {t("sidebar.delete")}
                </button>
              </td>
            </tr>
          ))}
          {table.paged.length === 0 && (
            <tr>
              <td colSpan={COLUMN_KEYS.length + 1} className="py-8 text-center text-ink/40">
                {t("sidebar.noResults")}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <TablePagination
        page={table.page}
        totalPages={table.totalPages}
        total={table.total}
        pageSize={table.pageSize}
        pageSizes={table.PAGE_SIZES}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
      />

      <DeleteModal
        open={!!pendingDelete}
        description={t("admin.analysesTable.deleteConfirm")}
        busy={!!busyId}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
