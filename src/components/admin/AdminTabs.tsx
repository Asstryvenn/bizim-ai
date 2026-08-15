"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  AdminStats,
  AdminUserRow,
  AdminBusinessRow,
  AdminAnalysisRow,
  AdminGrowthToolRow,
  AdminTopBusiness,
  AdminDailyPoint,
} from "@/types";
import AdminOverview from "./AdminOverview";
import UsersTable from "./UsersTable";
import BusinessesTable from "./BusinessesTable";
import AnalysesTable from "./AnalysesTable";
import GrowthToolsTable from "./GrowthToolsTable";
import AdminSystemTab, { type AdminSystemData } from "./AdminSystemTab";

type Tab = "overview" | "users" | "businesses" | "analyses" | "tools" | "system";

const TAB_KEYS: { id: Tab; key: string }[] = [
  { id: "overview", key: "admin.tabs.overview" },
  { id: "users", key: "admin.tabs.users" },
  { id: "businesses", key: "admin.tabs.businesses" },
  { id: "analyses", key: "admin.tabs.analyses" },
  { id: "tools", key: "admin.tabs.tools" },
  { id: "system", key: "admin.tabs.system" },
];

interface Props {
  stats: AdminStats;
  users: AdminUserRow[];
  businesses: AdminBusinessRow[];
  analyses: AdminAnalysisRow[];
  growthTools: AdminGrowthToolRow[];
  topBusinesses: AdminTopBusiness[];
  registrationsSeries: AdminDailyPoint[];
  analysesSeries: AdminDailyPoint[];
  systemData: AdminSystemData;
}

export default function AdminTabs({
  stats,
  users,
  businesses,
  analyses,
  growthTools,
  topBusinesses,
  registrationsSeries,
  analysesSeries,
  systemData,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {TAB_KEYS.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              tab === tabItem.id
                ? "border-accent text-accent"
                : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {t(tabItem.key)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <AdminOverview
          stats={stats}
          registrationsSeries={registrationsSeries}
          analysesSeries={analysesSeries}
          topBusinesses={topBusinesses}
        />
      )}
      {tab === "users" && <UsersTable users={users} />}
      {tab === "businesses" && <BusinessesTable businesses={businesses} />}
      {tab === "analyses" && <AnalysesTable analyses={analyses} />}
      {tab === "tools" && <GrowthToolsTable tools={growthTools} />}
      {tab === "system" && <AdminSystemTab data={systemData} />}
    </div>
  );
}
