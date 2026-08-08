"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUserRow } from "@/types";

export type UserFilter = "all" | "admin" | "user" | "active" | "no_business" | "new_week";

const FILTER_KEYS: { id: UserFilter; key: string }[] = [
  { id: "all", key: "admin.search.filters.all" },
  { id: "admin", key: "admin.search.filters.admin" },
  { id: "user", key: "admin.search.filters.user" },
  { id: "active", key: "admin.search.filters.active" },
  { id: "no_business", key: "admin.search.filters.noBusiness" },
  { id: "new_week", key: "admin.search.filters.newWeek" },
];

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function filterUsers(users: AdminUserRow[], query: string, filter: UserFilter) {
  const q = query.trim().toLowerCase();
  const now = Date.now();

  return users.filter((u) => {
    const matchesQuery =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.business_name ?? "").toLowerCase().includes(q) ||
      (u.city ?? "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q);

    if (!matchesQuery) return false;

    switch (filter) {
      case "admin":
        return u.role === "admin";
      case "user":
        return u.role === "user";
      case "active":
        return !!u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() <= THIRTY_DAYS;
      case "no_business":
        return !u.business_id;
      case "new_week":
        return now - new Date(u.created_at).getTime() <= SEVEN_DAYS;
      default:
        return true;
    }
  });
}

interface AdminSearchProps {
  users: AdminUserRow[];
  onFilteredChange: (filtered: AdminUserRow[]) => void;
}

// Мгновенный поиск (email/бизнес/город/роль) + быстрые фильтры для вкладки Users.
// Логика фильтрации вынесена в filterUsers(), чтобы её можно было переиспользовать/тестировать.
export default function AdminSearch({ users, onFilteredChange }: AdminSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");

  const filtered = useMemo(() => filterUsers(users, query, filter), [users, query, filter]);

  useEffect(() => {
    onFilteredChange(filtered);
  }, [filtered, onFilteredChange]);

  return (
    <div className="space-y-3 mb-4">
      <input
        className="input md:w-96"
        placeholder={t("admin.search.placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {FILTER_KEYS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
              filter === f.id
                ? "bg-accent text-white border-accent"
                : "border-border text-ink/60 hover:bg-mist"
            }`}
          >
            {t(f.key)}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink/40">
        {t("admin.search.countOf", { filtered: filtered.length, total: users.length })}
      </p>
    </div>
  );
}
