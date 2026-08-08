import OpenAI from "openai";

export class OpenAINotConfiguredError extends Error {
  constructor() {
    super(
      "OPENAI_API_KEY не задан. Добавьте ключ в .env.local (см. .env.example), " +
        "получить его можно на https://platform.openai.com/api-keys"
    );
    this.name = "OpenAINotConfiguredError";
  }
}

const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-5";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAINotConfiguredError();
  }
  return new OpenAI({ apiKey });
}

export async function generateAnalysisReport(prompt: string): Promise<string> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text || text.trim().length === 0) {
    throw new Error("OpenAI вернул пустой ответ. Попробуйте повторить анализ.");
  }
  return text;
}

export interface GrowthToolSection {
  label: string;
  content: string;
}

export interface GrowthToolContent {
  title: string;
  sections: GrowthToolSection[];
}

/**
 * Генерация одного из AI-инструментов для развития бизнеса
 * (акция, пост, сценарий, программа лояльности и т.п.).
 * Переиспользует тот же getClient()/CHAT_MODEL, что и остальной модуль —
 * ничего нового в конфигурации OpenAI не создаёт.
 */
export async function generateGrowthTool(prompt: string): Promise<GrowthToolContent> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text || text.trim().length === 0) {
    throw new Error("OpenAI вернул пустой ответ. Попробуйте ещё раз.");
  }

  // Модель иногда оборачивает JSON в ```json ... ``` несмотря на инструкцию —
  // подчищаем это перед парсингом, но саму валидацию формата не ослабляем.
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("OpenAI вернул невалидный JSON. Попробуйте повторить генерацию.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as GrowthToolContent).title !== "string" ||
    !Array.isArray((parsed as GrowthToolContent).sections)
  ) {
    throw new Error("OpenAI вернул ответ в неожиданном формате (нет title/sections).");
  }

  const content = parsed as GrowthToolContent;

  const sections = content.sections.filter(
    (s): s is GrowthToolSection =>
      !!s && typeof s.label === "string" && typeof s.content === "string"
  );

  if (sections.length === 0) {
    throw new Error("OpenAI вернул пустой список sections.");
  }

  return { title: content.title, sections };
}

export interface OpenAIChatTurn {
  role: "user" | "model";
  content: string;
}

function buildChatMessages(
  history: OpenAIChatTurn[],
  systemContext: string,
  newMessage: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: systemContext },
    ...history.map((turn) => ({
      role: (turn.role === "model" ? "assistant" : "user") as "assistant" | "user",
      content: turn.content,
    })),
    { role: "user", content: newMessage },
  ];
}

/**
 * Многоходовой чат с реальной историей сообщений (не-стриминговый вариант,
 * оставлен для мест, где нужен цельный ответ одним запросом).
 */
export async function generateChatReply(
  history: OpenAIChatTurn[],
  systemContext: string,
  newMessage: string
): Promise<string> {
  const client = getClient();
  const messages = buildChatMessages(history, systemContext, newMessage);

  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text || text.trim().length === 0) {
    throw new Error("OpenAI вернул пустой ответ. Попробуйте переформулировать вопрос.");
  }
  return text;
}

/**
 * Стриминговый вариант того же чата — возвращает тот же async iterable,
 * что и OpenAI SDK, чтобы вызывающий код (route handler) мог сам решать,
 * как отдавать чанки клиенту. Использует ту же сборку messages/модель,
 * что и generateChatReply — поведение ассистента не меняется, меняется
 * только способ доставки токенов.
 */
export async function streamChatReply(
  history: OpenAIChatTurn[],
  systemContext: string,
  newMessage: string
) {
  const client = getClient();
  const messages = buildChatMessages(history, systemContext, newMessage);

  return client.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    stream: true,
  });
}
