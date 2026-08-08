import Link from "next/link";
import ThemeToggle from "@/components/admin/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserMenu from "@/components/UserMenu";

interface DashboardNavProps {
  businessName: string;
  isAdmin?: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
}

// Раньше здесь была статичная кнопка "Выйти" и голое имя бизнеса.
// Теперь справа — полноценный "личный кабинет": инициалы с выпадающим меню
// (имя, email, "Настройки", "Admin Panel", "Выйти") — см. UserMenu.
export default function DashboardNav({
  businessName,
  isAdmin = false,
  firstName = "",
  lastName = "",
  email = "",
}: DashboardNavProps) {
  return (
    <header className="border-b border-border bg-paper">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Bizim
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-ink/50">{businessName}</span>
          <LanguageSwitcher />
          <ThemeToggle />
          <UserMenu
            firstName={firstName}
            lastName={lastName}
            email={email}
            businessName={businessName}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </header>
  );
}
