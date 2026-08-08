"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { AdminUserRow } from "@/types";
import AdminSearch from "./AdminSearch";
import { ExportUsersButton } from "./AdminExportButtons";
import DeleteModal from "./DeleteModal";
import TablePagination from "./TablePagination";
import { useAdminTable } from "@/lib/useAdminTable";
import i18n from "@/lib/i18n";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const getSortValue = (u: AdminUserRow, key: string): string | number => {
  switch (key) {
    case "email":
      return u.email.toLowerCase();
    case "created_at":
      return new Date(u.created_at).getTime();
    case "business_name":
      return (u.business_name ?? "").toLowerCase();
    case "city":
      return (u.city ?? "").toLowerCase();
    case "role":
      return u.role;
    case "last_sign_in_at":
      return u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
    case "analyses_count":
      return u.analyses_count;
    default:
      return "";
  }
};

const COLUMN_KEYS: { key: string; labelKey: string }[] = [
  { key: "email", labelKey: "admin.usersTable.columns.email" },
  { key: "created_at", labelKey: "admin.usersTable.columns.registration" },
  { key: "business_name", labelKey: "admin.usersTable.columns.business" },
  { key: "city", labelKey: "admin.usersTable.columns.city" },
  { key: "role", labelKey: "admin.usersTable.columns.role" },
  { key: "last_sign_in_at", labelKey: "admin.usersTable.columns.lastLogin" },
  { key: "analyses_count", labelKey: "admin.usersTable.columns.analyses" },
];

export default function UsersTable({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [filtered, setFiltered] = useState<AdminUserRow[]>(users);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUserRow | null>(null);

  const handleFilteredChange = useCallback((rows: AdminUserRow[]) => setFiltered(rows), []);

  const table = useAdminTable(filtered, getSortValue);

  const setRole = async (userId: string, role: "admin" | "user") => {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.usersTable.errors.roleChangeFailed"));
      toast.success(t("admin.usersTable.roleUpdated"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chat.genericErrorShort"));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const userId = pendingDelete.user_id;
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.usersTable.errors.deleteFailed"));
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
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-2">
        <div className="flex-1">
          <AdminSearch users={users} onFilteredChange={handleFilteredChange} />
        </div>
        <ExportUsersButton users={filtered} />
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
          {table.paged.map((u) => (
            <tr
              key={u.user_id}
              className="border-b border-border last:border-0 hover:bg-mist transition-colors"
            >
              <td className="py-2 pr-4">{u.email}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{formatDate(u.created_at)}</td>
              <td className="py-2 pr-4">{u.business_name ?? "—"}</td>
              <td className="py-2 pr-4">{u.city ?? "—"}</td>
              <td className="py-2 pr-4">
                <span className={u.role === "admin" ? "text-accent font-medium" : "text-ink/60"}>
                  {u.role}
                </span>
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">{formatDate(u.last_sign_in_at)}</td>
              <td className="py-2 pr-4">{u.analyses_count}</td>
              <td className="py-2 pr-4">
                <div className="flex gap-2">
                  {u.role === "admin" ? (
                    <button
                      className="btn-secondary text-xs py-1.5 px-3"
                      disabled={busyId === u.user_id}
                      onClick={() => setRole(u.user_id, "user")}
                    >
                      {t("admin.usersTable.makeUser")}
                    </button>
                  ) : (
                    <button
                      className="btn-secondary text-xs py-1.5 px-3"
                      disabled={busyId === u.user_id}
                      onClick={() => setRole(u.user_id, "admin")}
                    >
                      {t("admin.usersTable.makeAdmin")}
                    </button>
                  )}
                  <button
                    className="text-xs py-1.5 px-3 rounded-xl badge-danger hover:bg-danger/20 disabled:opacity-50 transition"
                    disabled={busyId === u.user_id}
                    onClick={() => setPendingDelete(u)}
                  >
                    {t("sidebar.delete")}
                  </button>
                </div>
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
        description={
          pendingDelete
            ? t("admin.usersTable.deleteConfirm", { email: pendingDelete.email })
            : undefined
        }
        busy={!!busyId}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
