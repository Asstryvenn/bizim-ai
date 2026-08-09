"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";

interface UserMenuProps {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  isAdmin?: boolean;
}

function getInitials(firstName: string, lastName: string, email: string) {
  const a = (firstName ?? "").trim().charAt(0);
  const b = (lastName ?? "").trim().charAt(0);
  const initials = `${a}${b}`.trim();
  if (initials) return initials.toUpperCase();
  return ((email ?? "").charAt(0) || "?").toUpperCase();
}

export default function UserMenu({
  firstName,
  lastName,
  email,
  businessName,
  isAdmin = false,
}: UserMenuProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || businessName;
  const initials = getInitials(firstName, lastName, email);

  // Закрываем меню по клику вне него и по Escape.
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    const supabase = createClient();
    // signOut() очищает и локальную сессию, и auth-куки (через @supabase/ssr),
    // так что после него middleware больше не увидит пользователя как залогиненного.
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const Avatar = ({ size }: { size: "sm" | "md" }) => {
    const dims = size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
    return (
      <span
        className={`${dims} flex items-center justify-center rounded-full bg-accent font-medium text-accent-foreground`}
      >
        {initials}
      </span>
    );
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full transition hover:opacity-80"
      >
        <Avatar size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="card absolute right-0 z-50 mt-2 w-64 p-2 shadow-xl animate-fade-in"
        >
          <div className="flex items-center gap-3 p-2.5">
            <Avatar size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{fullName}</p>
              <p className="truncate text-xs text-ink/50">{email}</p>
            </div>
          </div>

          <div className="my-1 border-t border-border" />

          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-ink/80 transition hover:bg-mist"
            >
              {t("nav.adminPanel")}
            </Link>
          )}

          <Link
            href="/dashboard/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm text-ink/80 transition hover:bg-mist"
          >
            {t("nav.settings")}
          </Link>

          <Link
            href="/dashboard/pricing"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm text-ink/80 transition hover:bg-mist"
          >
            {t("nav.pricing")}
          </Link>

          <div className="my-1 border-t border-border" />

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
          >
            {t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
