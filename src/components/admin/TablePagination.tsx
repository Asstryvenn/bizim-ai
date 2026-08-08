"use client";

import { useTranslation } from "react-i18next";
import type { PageSize } from "@/lib/useAdminTable";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: PageSize;
  pageSizes: readonly PageSize[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export default function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizes,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-border text-sm">
      <div className="flex items-center gap-2 text-ink/50">
        <span>{t("admin.pagination.total", { count: total })}</span>
        <span className="text-ink/20">•</span>
        <label className="flex items-center gap-1.5">
          {t("admin.pagination.show")}
          <select
            className="rounded-lg border border-border bg-card px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← {t("admin.pagination.back")}
        </button>
        <span className="text-ink/50 text-xs">
          {t("admin.pagination.pageOf", { page, totalPages })}
        </span>
        <button
          type="button"
          className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("admin.pagination.forward")} →
        </button>
      </div>
    </div>
  );
}
