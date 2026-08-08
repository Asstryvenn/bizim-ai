import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K | null;
  direction: SortDirection;
}

const PAGE_SIZES = [20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/**
 * Общая логика сортировки + пагинации для таблиц Admin Panel
 * (Users / Businesses / Analyses / Growth Tools). Каждая таблица передаёт
 * свои данные и функцию доступа к полю для сортировки по клику на заголовок.
 */
export function useAdminTable<T>(
  rows: T[],
  getSortValue: (row: T, key: string) => string | number
) {
  const [sort, setSort] = useState<SortState<string>>({ key: null, direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = getSortValue(a, sort.key as string);
      const bv = getSortValue(b, sort.key as string);
      if (av === bv) return 0;
      const result = av > bv ? 1 : -1;
      return sort.direction === "asc" ? result : -result;
    });
    return copy;
  }, [rows, sort, getSortValue]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  );

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  return {
    sort,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: sorted.length,
    paged,
    PAGE_SIZES,
  };
}

export function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return null;
  return direction === "asc" ? "▲" : "▼";
}
