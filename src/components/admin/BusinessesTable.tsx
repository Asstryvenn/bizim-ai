"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { AdminBusinessRow } from "@/types";
import { BUSINESS_TYPES } from "@/lib/validation";
import { ExportBusinessesButton } from "./AdminExportButtons";
import DeleteModal from "./DeleteModal";
import TablePagination from "./TablePagination";
import { useAdminTable } from "@/lib/useAdminTable";

const getSortValue = (b: AdminBusinessRow, key: string): string | number => {
  switch (key) {
    case "business_name":
      return b.business_name.toLowerCase();
    case "business_type":
      return b.business_type;
    case "city":
      return b.city.toLowerCase();
    case "employees_count":
      return b.employees_count;
    case "average_check":
      return b.average_check;
    case "analyses_count":
      return b.analyses_count;
    case "growth_tools_count":
      return b.growth_tools_count;
    default:
      return "";
  }
};

const COLUMN_KEYS: { key: string; labelKey: string }[] = [
  { key: "business_name", labelKey: "admin.businessesTable.columns.name" },
  { key: "business_type", labelKey: "admin.businessesTable.columns.type" },
  { key: "city", labelKey: "admin.businessesTable.columns.city" },
  { key: "employees_count", labelKey: "admin.businessesTable.columns.employees" },
  { key: "average_check", labelKey: "admin.businessesTable.columns.averageCheck" },
  { key: "analyses_count", labelKey: "admin.businessesTable.columns.analyses" },
  { key: "growth_tools_count", labelKey: "admin.businessesTable.columns.growthTools" },
];

export default function BusinessesTable({ businesses }: { businesses: AdminBusinessRow[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AdminBusinessRow>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminBusinessRow | null>(null);

  const typeLabel = (value: string) => {
    const bt = BUSINESS_TYPES.find((x) => x.value === value);
    return bt ? t(bt.labelKey) : value;
  };

  const filtered = useMemo(() => {
    return businesses.filter((b) => {
      const matchesQuery =
        !query ||
        b.business_name.toLowerCase().includes(query.toLowerCase()) ||
        b.city.toLowerCase().includes(query.toLowerCase());
      const matchesType = !typeFilter || b.business_type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [businesses, query, typeFilter]);

  const table = useAdminTable(filtered, getSortValue);

  const startEdit = (b: AdminBusinessRow) => {
    setEditingId(b.id);
    setDraft({
      business_name: b.business_name,
      business_type: b.business_type,
      city: b.city,
      employees_count: b.employees_count,
      average_check: b.average_check,
    });
  };

  const saveEdit = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.businessesTable.errors.saveFailed"));
      setEditingId(null);
      toast.success(t("settings.saved"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chat.genericErrorShort"));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.businessesTable.errors.deleteFailed"));
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
      <div className="flex flex-col md:flex-row gap-3 mb-4 md:items-center md:justify-between">
        <div className="flex flex-col md:flex-row gap-3 flex-1">
          <input
            className="input"
            placeholder={t("admin.businessesTable.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input md:w-56"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">{t("admin.businessesTable.allTypes")}</option>
            {BUSINESS_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>
                {t(bt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <ExportBusinessesButton businesses={filtered} />
      </div>

      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="text-left text-ink/40 text-xs uppercase tracking-wide border-b border-border">
            {COLUMN_KEYS.map((col) => (
              <th key={col.key} className="py-2 pr-4">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-ink transition"
                  onClick={() => table.toggleSort(col.key)}
                >
                  {t(col.labelKey)}
                  {table.sort.key === col.key && (table.sort.direction === "asc" ? "▲" : "▼")}
                </button>
              </th>
            ))}
            <th className="py-2 pr-4">{t("admin.usersTable.columns.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {table.paged.map((b) => (
            <tr
              key={b.id}
              className="border-b border-border last:border-0 align-top hover:bg-mist transition-colors"
            >
              {editingId === b.id ? (
                <>
                  <td className="py-2 pr-4">
                    <input
                      className="input"
                      value={draft.business_name ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, business_name: e.target.value }))}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      className="input"
                      value={draft.business_type ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, business_type: e.target.value }))}
                    >
                      {BUSINESS_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>
                          {t(bt.labelKey)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      className="input"
                      value={draft.city ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      className="input"
                      value={draft.employees_count ?? 0}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, employees_count: Number(e.target.value) }))
                      }
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      className="input"
                      value={draft.average_check ?? 0}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, average_check: Number(e.target.value) }))
                      }
                    />
                  </td>
                  <td className="py-2 pr-4">{b.analyses_count}</td>
                  <td className="py-2 pr-4">{b.growth_tools_count}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <button
                        className="btn-primary text-xs py-1.5 px-3"
                        disabled={busyId === b.id}
                        onClick={() => saveEdit(b.id)}
                      >
                        {t("admin.businessesTable.save")}
                      </button>
                      <button
                        className="btn-secondary text-xs py-1.5 px-3"
                        onClick={() => setEditingId(null)}
                      >
                        {t("chat.cancel")}
                      </button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="py-2 pr-4">{b.business_name}</td>
                  <td className="py-2 pr-4">{typeLabel(b.business_type)}</td>
                  <td className="py-2 pr-4">{b.city}</td>
                  <td className="py-2 pr-4">{b.employees_count}</td>
                  <td className="py-2 pr-4">{b.average_check} ₸</td>
                  <td className="py-2 pr-4">{b.analyses_count}</td>
                  <td className="py-2 pr-4">{b.growth_tools_count}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => startEdit(b)}>
                        {t("admin.businessesTable.edit")}
                      </button>
                      <button
                        className="text-xs py-1.5 px-3 rounded-xl badge-danger hover:bg-danger/20 disabled:opacity-50 transition"
                        disabled={busyId === b.id}
                        onClick={() => setPendingDelete(b)}
                      >
                        {t("sidebar.delete")}
                      </button>
                    </div>
                  </td>
                </>
              )}
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
        description={
          pendingDelete
            ? t("admin.businessesTable.deleteConfirm", { name: pendingDelete.business_name })
            : undefined
        }
        busy={!!busyId}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
