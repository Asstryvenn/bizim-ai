import type { Business } from "@/types";
import type { ComputedStats } from "@/lib/analytics";
import { WEEKDAY_KEYS } from "@/lib/analytics";

/**
 * Сервис-слой для Dashboard AI-блоков (Insights / Recommendations /
 * Action Center / Smart Alerts / Business Health / Customer Insights).
 *
 * Правило: если реальных данных бизнеса достаточно (импортированный файл
 * с выручкой/клиентами, либо заполненные поля клиентов/среднего чека в
 * профиле бизнеса) — считаем из них. Если данных недостаточно —
 * возвращаем demo-набор с явным isDemo:true. Ничего из demo НИКОГДА не
 * пишется в Supabase — это чистая функция на входных данных со страницы.
 */

export type Severity = "high" | "medium" | "low";
export type Priority = "HIGH" | "MEDIUM" | "LOW";

export interface AIInsightItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  impact?: string;
}

/**
 * Заготовка кампании, которую AI может предзаполнить в Campaign Builder.
 * Только у тех recommendation/action-center items, которые реально
 * представляют собой предложение запустить акцию — единственный источник
 * данных для Campaign Builder, ничего не дублируется отдельно.
 */
export interface CampaignSeed {
  name: string;
  reason: string;
  period: string;
  campaignType: string;
  discount: string;
  description: string;
  expectedImpact: string | null;
}

export interface AIRecommendationItem {
  id: string;
  priority: Priority;
  title: string;
  reason: string;
  expectedImpact: string;
  ctaLabel: string;
  ctaHref: string;
  campaignSeed?: CampaignSeed;
}

export interface SmartAlertItem {
  id: string;
  severity: Severity;
  icon: string;
  title: string;
  description: string;
  action: string;
}

export interface HealthBreakdownItem {
  key: string;
  label: string;
  score: number; // 0-100
}

export interface BusinessHealth {
  score: number; // 0-100
  breakdown: HealthBreakdownItem[];
  summary: string;
}

export interface ActionCenterItem {
  id: string;
  severity: Severity;
  title: string;
  cause: string;
  action: string;
  expectedImpact: string;
  ctaLabel: string;
  ctaHref: string;
  campaignSeed?: CampaignSeed;
}

export interface AIInsightsBundle {
  isDemo: boolean;
  insights: AIInsightItem[];
  recommendations: AIRecommendationItem[];
  alerts: SmartAlertItem[];
  health: BusinessHealth;
  actionCenter: ActionCenterItem[];
}

const CHAT_HREF = "/dashboard/chat";
const IMPORT_HREF = "/dashboard#import-panel";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function hasRealSalesData(stats: ComputedStats): boolean {
  return stats.totalRevenue !== null || stats.totalClients !== null;
}

function hasRealCustomerData(business: Business): boolean {
  return (
    (business.clients_week ?? 0) > 0 ||
    (business.clients_month ?? 0) > 0 ||
    (business.clients_today ?? 0) > 0
  );
}

const WEEKDAY_LABEL: Record<string, { ru: string; en: string }> = {
  sun: { ru: "воскресенье", en: "Sunday" },
  mon: { ru: "понедельник", en: "Monday" },
  tue: { ru: "вторник", en: "Tuesday" },
  wed: { ru: "среда", en: "Wednesday" },
  thu: { ru: "четверг", en: "Thursday" },
  fri: { ru: "пятница", en: "Friday" },
  sat: { ru: "суббота", en: "Saturday" },
};

function weekdayLabel(key: string, lang: "ru" | "en") {
  return WEEKDAY_LABEL[key]?.[lang] ?? key;
}

/** Строит бандл AI-блоков из реальных данных бизнеса. */
function buildFromRealData(
  stats: ComputedStats,
  business: Business,
  lang: "ru" | "en"
): AIInsightsBundle {
  const insights: AIInsightItem[] = [];
  const recommendations: AIRecommendationItem[] = [];
  const alerts: SmartAlertItem[] = [];
  const actionCenter: ActionCenterItem[] = [];

  const revenue = stats.totalRevenue;
  const avgCheck = stats.averageCheck ?? (business.average_check || null);
  const weekClients = business.clients_week ?? null;
  const monthClients = business.clients_month ?? null;
  const weeklyAvgFromMonth = monthClients ? monthClients / 4 : null;

  // ---- Revenue / best-worst day insight ----
  if (stats.bestDay && stats.worstDay && stats.bestDay.label !== stats.worstDay.label) {
    const diff = stats.bestDay.revenue - stats.worstDay.revenue;
    const pct =
      stats.worstDay.revenue > 0 ? Math.round((diff / stats.worstDay.revenue) * 100) : null;
    insights.push({
      id: "best-worst-day",
      icon: "📊",
      title:
        lang === "ru"
          ? "Есть заметный разброс выручки по дням"
          : "Revenue varies noticeably by day",
      description:
        lang === "ru"
          ? `Лучший день по выручке принёс ${Math.round(stats.bestDay.revenue).toLocaleString("ru-RU")} ₸, худший — ${Math.round(stats.worstDay.revenue).toLocaleString("ru-RU")} ₸.`
          : `Best day brought in ${Math.round(stats.bestDay.revenue).toLocaleString("en-US")}, worst — ${Math.round(stats.worstDay.revenue).toLocaleString("en-US")}.`,
      impact: pct !== null ? `${pct > 0 ? "+" : ""}${pct}%` : undefined,
    });
  }

  // ---- Best weekday (from revenueByWeekday) ----
  if (stats.revenueByWeekday && stats.revenueByWeekday.length > 0) {
    const best = [...stats.revenueByWeekday].sort((a, b) => b.revenue - a.revenue)[0];
    const worst = [...stats.revenueByWeekday].sort((a, b) => a.revenue - b.revenue)[0];
    if (best) {
      insights.push({
        id: "best-weekday",
        icon: "🗓",
        title:
          lang === "ru"
            ? `Самый сильный день недели — ${weekdayLabel(best.weekday, lang)}`
            : `Strongest day of the week is ${weekdayLabel(best.weekday, lang)}`,
        description:
          lang === "ru"
            ? "AI посчитал суммарную выручку по дням недели за загруженный период."
            : "AI summed revenue by weekday over the imported period.",
      });
    }
    if (worst && best && worst.weekday !== best.weekday) {
      const weakLabel = weekdayLabel(worst.weekday, lang);
      const title =
        lang === "ru" ? `Запустить акцию на ${weakLabel}` : `Launch a promo for ${weakLabel}`;
      const reason =
        lang === "ru"
          ? `Это самый слабый день недели по выручке.`
          : `This is the weakest day of the week by revenue.`;
      const expectedImpact = lang === "ru" ? "+8–12% продаж" : "+8–12% sales";

      recommendations.push({
        id: "boost-weak-day",
        priority: "MEDIUM",
        title,
        reason,
        expectedImpact,
        ctaLabel: lang === "ru" ? "Активировать акцию" : "Activate campaign",
        ctaHref: IMPORT_HREF,
        campaignSeed: {
          name: title,
          reason,
          period: weakLabel,
          campaignType: lang === "ru" ? "Скидка" : "Discount",
          discount: "10%",
          description:
            lang === "ru"
              ? `Скидка для клиентов в ${weakLabel.toLowerCase()}, чтобы сгладить провал по выручке.`
              : `A discount for customers on ${weakLabel} to smooth out the revenue dip.`,
          expectedImpact,
        },
      });
    }
  }

  // ---- Customers: week vs monthly average ----
  if (weekClients !== null && weeklyAvgFromMonth !== null && weeklyAvgFromMonth > 0) {
    const deltaPct = Math.round(((weekClients - weeklyAvgFromMonth) / weeklyAvgFromMonth) * 100);
    if (Math.abs(deltaPct) >= 5) {
      const up = deltaPct > 0;
      insights.push({
        id: "customer-trend",
        icon: up ? "📈" : "📉",
        title: up
          ? lang === "ru"
            ? "Активность клиентов выросла"
            : "Customer activity increased"
          : lang === "ru"
            ? "Активность клиентов снизилась"
            : "Customer activity decreased",
        description:
          lang === "ru"
            ? `Клиентов за эту неделю: ${weekClients}, против среднего ${Math.round(weeklyAvgFromMonth)} в неделю за последний месяц.`
            : `Clients this week: ${weekClients}, vs. average ${Math.round(weeklyAvgFromMonth)}/week over the last month.`,
        impact: `${deltaPct > 0 ? "+" : ""}${deltaPct}%`,
      });

      if (!up) {
        alerts.push({
          id: "customer-drop",
          severity: "medium",
          icon: "👥",
          title: lang === "ru" ? "Снижение активности клиентов" : "Customer retention decreased",
          description:
            lang === "ru"
              ? `Клиентов на этой неделе на ${Math.abs(deltaPct)}% меньше обычного.`
              : `Clients this week are down ${Math.abs(deltaPct)}% vs. usual.`,
          action:
            lang === "ru"
              ? "Рассмотрите программу лояльности или напоминание постоянным клиентам."
              : "Consider a loyalty program or a reminder to returning customers.",
        });
        {
          const cause =
            lang === "ru"
              ? `Клиентов на ${Math.abs(deltaPct)}% меньше, чем в среднем за месяц.`
              : `Clients are down ${Math.abs(deltaPct)}% vs. the monthly average.`;
          const action =
            lang === "ru"
              ? "Запустить программу лояльности для постоянных клиентов."
              : "Launch a loyalty program for returning customers.";
          const expectedImpact = lang === "ru" ? "выше удержание" : "higher retention";

          actionCenter.push({
            id: "sales-drop-action",
            severity: "medium",
            title: lang === "ru" ? "ПАДЕНИЕ АКТИВНОСТИ КЛИЕНТОВ" : "CUSTOMER ACTIVITY DROP",
            cause,
            action,
            expectedImpact,
            ctaLabel: lang === "ru" ? "Активировать акцию" : "Activate campaign",
            ctaHref: IMPORT_HREF,
            campaignSeed: {
              name: lang === "ru" ? "Программа лояльности" : "Loyalty program",
              reason: cause,
              period: lang === "ru" ? "Постоянно" : "Ongoing",
              campaignType: lang === "ru" ? "Программа лояльности" : "Loyalty program",
              discount: "10%",
              description: action,
              expectedImpact,
            },
          });
        }
      }
    }
  }

  // ---- Average check insight ----
  if (avgCheck !== null && avgCheck > 0) {
    insights.push({
      id: "avg-check",
      icon: "💳",
      title: lang === "ru" ? "Средний чек" : "Average check",
      description:
        lang === "ru"
          ? `Средний чек сейчас составляет ${Math.round(avgCheck).toLocaleString("ru-RU")} ₸.`
          : `Average check is currently ${Math.round(avgCheck).toLocaleString("en-US")}.`,
    });
  }

  // ---- Revenue drop alert (best vs worst framed as risk) ----
  if (revenue !== null && stats.worstDay && stats.bestDay) {
    const worstShare =
      stats.bestDay.revenue > 0 ? stats.worstDay.revenue / stats.bestDay.revenue : 1;
    if (worstShare < 0.5) {
      alerts.push({
        id: "sales-volatility",
        severity: "medium",
        icon: "⚠️",
        title: lang === "ru" ? "Продажи нестабильны по дням" : "Sales are volatile day-to-day",
        description:
          lang === "ru"
            ? "Разброс между лучшим и худшим днём превышает 2 раза."
            : "The gap between the best and worst day is more than 2x.",
        action:
          lang === "ru"
            ? "Сгладьте спрос акциями в слабые дни."
            : "Smooth demand with promos on weak days.",
      });
    }
  }

  // ---- Main problem from profile -> recommendation ----
  if (business.main_problem) {
    recommendations.push({
      id: "main-problem",
      priority: "HIGH",
      title:
        lang === "ru" ? "Решить главную проблему бизнеса" : "Address your top business problem",
      reason: business.main_problem,
      expectedImpact: lang === "ru" ? "устранение узкого места" : "removes a key bottleneck",
      ctaLabel: lang === "ru" ? "Спросить AI" : "Ask AI",
      ctaHref: CHAT_HREF,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "not-enough-data",
      icon: "ℹ️",
      title: lang === "ru" ? "Недостаточно данных для вывода" : "Not enough data yet",
      description:
        lang === "ru"
          ? "Загрузите файл с продажами, чтобы AI начал находить закономерности."
          : "Import a sales file so AI can start finding patterns.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "import-more-data",
      priority: "LOW",
      title: lang === "ru" ? "Загрузить больше данных" : "Import more data",
      reason:
        lang === "ru"
          ? "Чем больше данных, тем точнее рекомендации AI."
          : "More data means more accurate AI recommendations.",
      expectedImpact: lang === "ru" ? "точность рекомендаций" : "recommendation accuracy",
      ctaLabel: lang === "ru" ? "Загрузить файл" : "Import file",
      ctaHref: IMPORT_HREF,
    });
  }

  // ---- Business Health Score (только на основе реально доступных сигналов) ----
  const salesScore = revenue !== null ? clamp(60 + (stats.bestDay && stats.worstDay && stats.bestDay.revenue > 0 ? Math.round(((stats.bestDay.revenue - stats.worstDay.revenue) / stats.bestDay.revenue) * -30) : 0) + 20) : 50;
  const customersScore =
    weekClients !== null && weeklyAvgFromMonth
      ? clamp(60 + Math.round(((weekClients - weeklyAvgFromMonth) / (weeklyAvgFromMonth || 1)) * 100) / 2)
      : 50;
  const marketingScore = 50; // нет данных рекламы/маркетинга — нейтральная оценка
  const growthScore = stats.revenueByWeekday && stats.revenueByWeekday.length > 3 ? 65 : 50;
  const operationsScore = business.peak_hours ? 70 : 55;

  const breakdown: HealthBreakdownItem[] = [
    { key: "sales", label: lang === "ru" ? "Продажи" : "Sales", score: Math.round(salesScore) },
    {
      key: "customers",
      label: lang === "ru" ? "Клиенты" : "Customers",
      score: Math.round(customersScore),
    },
    {
      key: "marketing",
      label: lang === "ru" ? "Маркетинг" : "Marketing",
      score: Math.round(marketingScore),
    },
    { key: "growth", label: lang === "ru" ? "Рост" : "Growth", score: Math.round(growthScore) },
    {
      key: "operations",
      label: lang === "ru" ? "Операции" : "Operations",
      score: Math.round(operationsScore),
    },
  ];
  const score = Math.round(breakdown.reduce((sum, b) => sum + b.score, 0) / breakdown.length);

  const weakest = [...breakdown].sort((a, b) => a.score - b.score)[0];
  const health: BusinessHealth = {
    score,
    breakdown,
    summary:
      lang === "ru"
        ? `Бизнес работает ${score >= 75 ? "хорошо" : score >= 55 ? "неплохо" : "с трудностями"}, но раздел «${weakest.label}» можно улучшить.`
        : `Your business is performing ${score >= 75 ? "well" : score >= 55 ? "reasonably" : "below target"}, but "${weakest.label}" can be improved.`,
  };

  return { isDemo: false, insights, recommendations, alerts, health, actionCenter };
}

/** Demo-набор для UI, когда реальных данных ещё нет. Ничего не пишется в БД. */
function buildDemoBundle(lang: "ru" | "en"): AIInsightsBundle {
  const insights: AIInsightItem[] = [
    {
      id: "demo-revenue",
      icon: "📉",
      title:
        lang === "ru"
          ? "Выручка снизилась на 12% к прошлому периоду"
          : "Revenue is down 12% compared to the previous period",
      description:
        lang === "ru"
          ? "Демо-пример: после загрузки реальных продаж здесь появится точный расчёт."
          : "Demo example — import real sales data to see the exact calculation here.",
      impact: "-12%",
    },
    {
      id: "demo-returning",
      icon: "👥",
      title:
        lang === "ru"
          ? "Постоянные клиенты приносят большую часть выручки"
          : "Returning customers generate most of your revenue",
      description:
        lang === "ru"
          ? "Демо-пример на основе типичного распределения продаж малого бизнеса."
          : "Demo example based on a typical small-business sales distribution.",
    },
    {
      id: "demo-friday",
      icon: "🗓",
      title:
        lang === "ru"
          ? "Самый сильный период продаж — пятничный вечер"
          : "Your strongest sales period is Friday evening",
      description:
        lang === "ru"
          ? "Демо-пример: реальный день недели рассчитается из загруженного файла."
          : "Demo example — the real strongest day is computed once you import a file.",
    },
  ];

  const recommendations: AIRecommendationItem[] = [
    {
      id: "demo-weekend",
      priority: "HIGH",
      title: lang === "ru" ? "Запустить акцию на выходные" : "Launch a weekend promotion",
      reason:
        lang === "ru"
          ? "Демо-пример: обычно у малого бизнеса выходные — слабый период."
          : "Demo example — weekends are often a weak period for small businesses.",
      expectedImpact: lang === "ru" ? "+8–12% продаж" : "+8–12% sales",
      ctaLabel: lang === "ru" ? "Активировать акцию" : "Activate campaign",
      ctaHref: IMPORT_HREF,
      campaignSeed: {
        name: lang === "ru" ? "Акция на выходные" : "Weekend promotion",
        reason:
          lang === "ru"
            ? "Демо-пример: обычно у малого бизнеса выходные — слабый период."
            : "Demo example — weekends are often a weak period for small businesses.",
        period: lang === "ru" ? "Выходные" : "Weekend",
        campaignType: lang === "ru" ? "Скидка" : "Discount",
        discount: "10%",
        description:
          lang === "ru"
            ? "Скидка на выходные для привлечения дополнительного трафика."
            : "A weekend discount to attract extra foot traffic.",
        expectedImpact: lang === "ru" ? "+8–12% продаж" : "+8–12% sales",
      },
    },
    {
      id: "demo-returning-target",
      priority: "MEDIUM",
      title:
        lang === "ru" ? "Настроить предложение для постоянных клиентов" : "Target returning customers",
      reason:
        lang === "ru"
          ? "Демо-пример: удержание обычно дешевле привлечения новых клиентов."
          : "Demo example — retention is usually cheaper than new acquisition.",
      expectedImpact: lang === "ru" ? "выше удержание" : "higher retention",
      ctaLabel: lang === "ru" ? "Спросить AI" : "Ask AI",
      ctaHref: CHAT_HREF,
    },
  ];

  const alerts: SmartAlertItem[] = [
    {
      id: "demo-alert-sales",
      severity: "medium",
      icon: "⚠️",
      title: lang === "ru" ? "Продажи снизились на этой неделе" : "Sales dropped this week",
      description:
        lang === "ru" ? "Демо-пример уведомления AI." : "Demo example of an AI notification.",
      action:
        lang === "ru" ? "Загрузите данные, чтобы увидеть реальные алерты." : "Import data to see real alerts.",
    },
  ];

  const actionCenter: ActionCenterItem[] = [
    {
      id: "demo-action",
      severity: "medium",
      title: lang === "ru" ? "ОБНАРУЖЕНО ПАДЕНИЕ ПРОДАЖ" : "SALES DROP DETECTED",
      cause:
        lang === "ru"
          ? "Демо-пример: выручка снизилась на 12%. Возможная причина — низкая активность клиентов на выходных."
          : "Demo example: revenue decreased by 12%. Possible reason: lower weekend customer activity.",
      action: lang === "ru" ? "Запустить акцию на выходные." : "Launch a weekend promotion.",
      expectedImpact: "+8–12%",
      ctaLabel: lang === "ru" ? "Активировать акцию" : "Activate campaign",
      ctaHref: IMPORT_HREF,
      campaignSeed: {
        name: lang === "ru" ? "Акция на выходные" : "Weekend promotion",
        reason:
          lang === "ru"
            ? "Демо-пример: выручка снизилась на 12%. Возможная причина — низкая активность клиентов на выходных."
            : "Demo example: revenue decreased by 12%. Possible reason: lower weekend customer activity.",
        period: lang === "ru" ? "Выходные" : "Weekend",
        campaignType: lang === "ru" ? "Скидка" : "Discount",
        discount: "10%",
        description:
          lang === "ru"
            ? "Скидка на выходные для привлечения дополнительного трафика."
            : "A weekend discount to attract extra foot traffic.",
        expectedImpact: "+8–12%",
      },
    },
  ];

  const breakdown: HealthBreakdownItem[] = [
    { key: "sales", label: lang === "ru" ? "Продажи" : "Sales", score: 68 },
    { key: "customers", label: lang === "ru" ? "Клиенты" : "Customers", score: 74 },
    { key: "marketing", label: lang === "ru" ? "Маркетинг" : "Marketing", score: 55 },
    { key: "growth", label: lang === "ru" ? "Рост" : "Growth", score: 62 },
    { key: "operations", label: lang === "ru" ? "Операции" : "Operations", score: 70 },
  ];
  const score = Math.round(breakdown.reduce((s, b) => s + b.score, 0) / breakdown.length);

  return {
    isDemo: true,
    insights,
    recommendations,
    alerts,
    actionCenter,
    health: {
      score,
      breakdown,
      summary:
        lang === "ru"
          ? "Демо-пример: показываем, как будет выглядеть Business Health Score на реальных данных."
          : "Demo example: this is how your Business Health Score will look with real data.",
    },
  };
}

export function buildAIInsightsBundle(
  stats: ComputedStats,
  business: Business,
  lang: "ru" | "en"
): AIInsightsBundle {
  if (!hasRealSalesData(stats) && !hasRealCustomerData(business)) {
    return buildDemoBundle(lang);
  }
  return buildFromRealData(stats, business, lang);
}

export { WEEKDAY_KEYS };
