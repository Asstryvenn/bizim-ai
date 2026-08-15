"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface SidebarProps {
  isAdmin?: boolean;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/inventory", label: "Остатки", icon: "📦" },
  { href: "/dashboard/orders", label: "Заказы", icon: "🧾" },
  { href: "/dashboard/suppliers", label: "Поставщики", icon: "🚚" },
  { href: "/dashboard/suppliers/compare", label: "Сравнение поставщиков", icon: "⚖️" },
  { href: "/dashboard/forecast", label: "Прогноз", icon: "📈" },
  { href: "/dashboard/tools", label: "Инструменты", icon: "🧰" },
  { href: "/dashboard/recommendations", label: "Рекомендации", icon: "✨" },
  { href: "/dashboard/history", label: "История", icon: "🕘" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function NavLinks({ isAdmin, onNavigate }: { isAdmin?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-ink/60 hover:bg-mist hover:text-ink"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border px-3 py-4">
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink/60 transition hover:bg-mist hover:text-ink"
        >
          <span className="text-base">⚙️</span>
          Настройки
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink/60 transition hover:bg-mist hover:text-ink"
          >
            <span className="text-base">🛡️</span>
            Admin
          </Link>
        )}
      </div>
    </>
  );
}

export default function Sidebar({ isAdmin }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-border bg-paper">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">
            B
          </span>
          <span className="text-base font-semibold tracking-tight">Bizim</span>
        </div>
        <NavLinks isAdmin={isAdmin} />
      </aside>

      {/* Mobile top bar + slide-over menu */}
      <div className="flex items-center justify-between border-b border-border bg-paper px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">
            B
          </span>
          <span className="text-base font-semibold tracking-tight">Bizim</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Открыть меню"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink/70"
        >
          ☰
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-paper shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <span className="text-base font-semibold tracking-tight">Bizim</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Закрыть меню"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink/70"
              >
                ✕
              </button>
            </div>
            <NavLinks isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
