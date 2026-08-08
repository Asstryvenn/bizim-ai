import type { Business, GrowthToolType } from "@/types";
import type { ComputedStats } from "@/lib/analytics";
import { BUSINESS_TYPES } from "@/lib/validation";

export interface GrowthToolDefinition {
  id: GrowthToolType;
  icon: string;
  title: string;
  description: string;
  titleKey: string;
  descriptionKey: string;
}

// Порядок и состав карточек в разделе "AI-инструменты для развития бизнеса".
// title/description — русский fallback (для AI-промптов), titleKey/descriptionKey — для UI (i18n).
export const GROWTH_TOOL_DEFINITIONS: GrowthToolDefinition[] = [
  {
    id: "promo",
    icon: "🎁",
    title: "Создать акцию",
    description: "Готовая рекламная акция под слабые часы или дни бизнеса.",
    titleKey: "growth.tools.promo.title",
    descriptionKey: "growth.tools.promo.description",
  },
  {
    id: "instagram_post",
    icon: "📱",
    title: "Пост для Instagram",
    description: "Готовый текст поста с подписью и хэштегами.",
    titleKey: "growth.tools.instagram_post.title",
    descriptionKey: "growth.tools.instagram_post.description",
  },
  {
    id: "tiktok_script",
    icon: "🎥",
    title: "Сценарий для TikTok",
    description: "Сценарий короткого ролика: хук, сцены, подпись.",
    titleKey: "growth.tools.tiktok_script.title",
    descriptionKey: "growth.tools.tiktok_script.description",
  },
  {
    id: "loyalty_program",
    icon: "💳",
    title: "Программа лояльности",
    description: "Механика бонусов, подходящая именно этому бизнесу.",
    titleKey: "growth.tools.loyalty_program.title",
    descriptionKey: "growth.tools.loyalty_program.description",
  },
  {
    id: "coupon",
    icon: "🎟",
    title: "Купоны",
    description: "Идея купона со скидкой или подарком для клиентов.",
    titleKey: "growth.tools.coupon.title",
    descriptionKey: "growth.tools.coupon.description",
  },
  {
    id: "sms",
    icon: "📨",
    title: "SMS-рассылка",
    description: "Короткий текст SMS для базы клиентов.",
    titleKey: "growth.tools.sms.title",
    descriptionKey: "growth.tools.sms.description",
  },
  {
    id: "profit_tips",
    icon: "⭐",
    title: "Рекомендации по прибыли",
    description: "Конкретные шаги для увеличения прибыли на основе цифр.",
    titleKey: "growth.tools.profit_tips.title",
    descriptionKey: "growth.tools.profit_tips.description",
  },
];

export function getGrowthToolDefinition(toolType: string): GrowthToolDefinition | null {
  return GROWTH_TOOL_DEFINITIONS.find((t) => t.id === toolType) ?? null;
}

interface PromptContext {
  business: Business;
  analysisReport: string;
  stats: ComputedStats | Record<string, unknown> | null;
}

const RESPONSE_FORMAT_INSTRUCTIONS = `
Ответь СТРОГО в формате JSON, без markdown, без \`\`\`, без пояснений вне JSON.
Формат обязателен:
{
  "title": "конкретное название результата (не общее слово, а реальное название/заголовок)",
  "sections": [
    { "label": "название блока", "content": "текст блока" }
  ]
}
Не добавляй никаких полей кроме "title" и "sections".`;

function businessContextBlock(business: Business): string {
  const typeLabel =
    BUSINESS_TYPES.find((t) => t.value === business.business_type)?.label ??
    business.business_type;

  return `Бизнес: "${business.business_name}" (тип: ${typeLabel}), город ${business.city}.
Средний чек: ${business.average_check} ₸.
Клиентов в месяц: ${business.clients_month}.
Часы работы: ${business.work_hours_from ?? "не указаны"}–${business.work_hours_to ?? "не указаны"}.
Пиковые часы: ${business.peak_hours || "не указаны"}.
Основная заявленная проблема: ${business.main_problem || "не указана"}.`;
}

/**
 * Собирает промпт для конкретного AI-инструмента.
 * ВАЖНО: промпт всегда опирается на уже существующий AI-анализ (analysisReport)
 * и посчитанные метрики (stats) — никаких случайных советов "из воздуха".
 */
export function buildGrowthToolPrompt(toolType: GrowthToolType, ctx: PromptContext): string {
  const { business, analysisReport, stats } = ctx;

  const base = `Ты — AI-консультант по росту малого бизнеса в Казахстане, часть платформы Bizim.

${businessContextBlock(business)}

Вот уже готовый AI-анализ данных этого бизнеса (используй его как главный источник фактов):
"""
${analysisReport}
"""

Посчитанные метрики (JSON, используй только то, что реально есть, не выдумывай цифры):
${JSON.stringify(stats ?? {}, null, 2)}

Правило: все рекомендации должны быть основаны именно на этих данных.
Если в анализе видно, что продажи проседают в определённое время — предлагай решение под это время.
Если высокий средний чек — учитывай это в тоне и уровне предложения (премиальность).
Если много новых клиентов — делай акцент на удержании и повторных покупках.
Никаких общих фраз без опоры на конкретные цифры или факты из анализа выше.
`;

  const taskByType: Record<GrowthToolType, string> = {
    promo: `Задача: придумай ОДНУ конкретную рекламную акцию для этого бизнеса.
В "sections" обязательно включи блоки с label:
"Название акции", "Описание", "Сроки проведения", "Ожидаемый эффект", "Рекомендации по запуску".
Название акции — короткое и конкретное, в духе "Купи один — второй бесплатно" или "Скидка 15% после 18:00",
но подобранное под реальную ситуацию бизнеса (например, если вечером падают продажи — акция должна быть на вечер).`,

    instagram_post: `Задача: напиши ОДИН готовый пост для Instagram от имени этого бизнеса.
В "sections" включи блоки: "Текст поста", "Хэштеги", "Призыв к действию", "Лучшее время публикации".
Текст поста — живой, на русском языке, с учётом типа и города бизнеса, без воды.`,

    tiktok_script: `Задача: напиши сценарий короткого TikTok-ролика (15-30 секунд) для этого бизнеса.
В "sections" включи блоки: "Хук (первые 3 секунды)", "Сцены по порядку", "Текст на экране / озвучка", "Подпись и хэштеги".`,

    loyalty_program: `Задача: предложи программу лояльности, подходящую именно этому бизнесу и его цифрам.
В "sections" включи блоки: "Название программы", "Механика начисления бонусов", "Условия для клиента",
"Ожидаемый эффект для бизнеса".
Механика должна логично следовать из данных: например, если средний чек высокий — предложи VIP-уровень,
если много новых разовых клиентов — механику на удержание и повторную покупку.`,

    coupon: `Задача: придумай ОДИН купон для клиентов этого бизнеса.
В "sections" включи блоки: "Название купона", "Что дает купон", "Условия использования", "Срок действия".`,

    sms: `Задача: напиши текст SMS-рассылки для существующей базы клиентов этого бизнеса.
В "sections" включи блоки: "Текст SMS" (не более 160 символов), "Рекомендуемое время отправки", "Кому отправлять".`,

    profit_tips: `Задача: дай 3-5 конкретных рекомендаций по увеличению прибыли, основанных СТРОГО на цифрах анализа выше.
В "sections" сделай отдельный блок на каждую рекомендацию: label — короткое название рекомендации,
content — объяснение, почему это важно именно для этого бизнеса, с опорой на конкретные цифры.`,
  };

  return `${base}\n${taskByType[toolType]}\n${RESPONSE_FORMAT_INSTRUCTIONS}`;
}
