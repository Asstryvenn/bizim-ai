import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamChatReply, OpenAINotConfiguredError, type OpenAIChatTurn } from "@/lib/openai";
import { STREAM_ERROR_MARKER, STREAM_META_MARKER, type StreamMeta } from "@/lib/chatStream";

type ChatMode = "send" | "regenerate" | "continue";

interface ChatRequestBody {
  conversationId: string;
  message?: string;
  mode?: ChatMode;
  targetMessageId?: string;
}

function buildSystemContext(business: Record<string, unknown>) {
  return `Ты — AI-консультант платформы Bizim для владельца малого бизнеса в Казахстане.
Бизнес: "${business.business_name}" (${business.business_type}), город ${business.city}.
Сотрудников: ${business.employees_count}. Средний чек: ${business.average_check}.
Клиентов сегодня/неделя/месяц/год: ${business.clients_today}/${business.clients_week}/${business.clients_month}/${business.clients_year}.
Основная проблема бизнеса: ${business.main_problem || "не указана"}.
Последний AI-анализ: ${business.last_analysis || "анализ ещё не проводился"}.
Отвечай кратко и по делу на русском языке, опираясь на эти данные. Используй markdown (списки, **жирный текст**, таблицы, блоки кода \`\`\`), когда это уместно. Если данных не хватает для конкретного совета — так и скажи.`;
}

function autoTitle(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= 48) return clean;
  return `${clean.slice(0, 48).trim()}…`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { conversationId, message, mode = "send", targetMessageId } =
    (await request.json()) as ChatRequestBody;

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId обязателен" }, { status: 400 });
  }
  if (mode === "send" && (!message || !message.trim())) {
    return NextResponse.json({ error: "message обязателен" }, { status: 400 });
  }
  if (mode === "continue" && !targetMessageId) {
    return NextResponse.json({ error: "targetMessageId обязателен для continue" }, { status: 400 });
  }

  // Сначала читаем диалог (нужно проверить, что он принадлежит пользователю),
  // затем бизнес — он читается по conversation.business_id, поэтому
  // распараллелить эти два запроса нельзя, второй зависит от первого.
  const { data: conversation, error: conversationError } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", conversation.business_id)
    .eq("user_id", user.id)
    .single();

  if (businessError || !business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }

  const systemContext = buildSystemContext(business);

  try {
    let history: OpenAIChatTurn[] = [];
    let newMessage = "";
    let userMessageId: string | undefined;
    let targetRowId: string | null = null;
    let previousContent = "";

    if (mode === "send") {
      newMessage = message!.trim();

      // История нужна для контекста OpenAI, а insert нового сообщения от
      // пользователя ни от чего не зависит — запускаем оба запроса к
      // Supabase параллельно вместо последовательного ожидания.
      const [{ data: existing, error: historyError }, { data: inserted, error: insertError }] =
        await Promise.all([
          supabase
            .from("chat_messages")
            .select("role, content, created_at")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .limit(40),
          supabase
            .from("chat_messages")
            .insert({
              user_id: user.id,
              business_id: conversation.business_id,
              conversation_id: conversationId,
              role: "user",
              content: newMessage,
            })
            .select("id")
            .single(),
        ]);

      if (historyError) {
        return NextResponse.json({ error: historyError.message }, { status: 500 });
      }
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      history = (existing ?? []).map((h: { role: string; content: string }) => ({ role: h.role as "user" | "model", content: h.content }));
      userMessageId = inserted?.id;
    } else if (mode === "regenerate") {
      // Удаляем последний ответ модели (если он есть) и просим её ответить заново
      // на тот же последний вопрос пользователя.
      const { data: last } = await supabase
        .from("chat_messages")
        .select("id, role")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (last?.role === "model") {
        await supabase.from("chat_messages").delete().eq("id", last.id);
      }

      const { data: remaining, error: remainingError } = await supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(40);
      if (remainingError) {
        return NextResponse.json({ error: remainingError.message }, { status: 500 });
      }
      const turns = (remaining ?? []).map((h: { role: string; content: string }) => ({ role: h.role as "user" | "model", content: h.content }));
      const lastTurn = turns.pop();
      if (!lastTurn || lastTurn.role !== "user") {
        return NextResponse.json({ error: "Нечего регенерировать — нет предыдущего вопроса" }, { status: 400 });
      }
      history = turns;
      newMessage = lastTurn.content;
    } else {
      // continue
      const { data: targetRow, error: targetError } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("id", targetMessageId!)
        .eq("conversation_id", conversationId)
        .single();
      if (targetError || !targetRow || targetRow.role !== "model") {
        return NextResponse.json({ error: "Сообщение для продолжения не найдено" }, { status: 404 });
      }
      targetRowId = targetRow.id;
      previousContent = targetRow.content;

      const { data: existing, error: historyError } = await supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(40);
      if (historyError) {
        return NextResponse.json({ error: historyError.message }, { status: 500 });
      }
      history = (existing ?? []).map((h: { role: string; content: string }) => ({ role: h.role as "user" | "model", content: h.content }));
      newMessage =
        "Продолжи свой предыдущий ответ ровно с того места, на котором он оборвался. " +
        "Не здоровайся заново и не повторяй уже сказанное — только продолжение текста.";
    }

    const openaiStream = await streamChatReply(history, systemContext, newMessage);

    const encoder = new TextEncoder();
    let fullText = "";

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const safeEnqueue = (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            // Клиент уже отключился (Stop generation) — просто перестаём
            // писать в поток, но продолжаем считать fullText ниже, чтобы
            // сохранить частичный ответ в базу.
          }
        };

        try {
          for await (const chunk of openaiStream) {
            if (request.signal.aborted) break;
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              safeEnqueue(delta);
            }
          }

          const finalText = mode === "continue" ? `${previousContent}${fullText}` : fullText;

          if (!fullText.trim() && !request.signal.aborted) {
            throw new Error("OpenAI вернул пустой ответ. Попробуйте переформулировать вопрос.");
          }

          let modelMessageId = "";

          if (mode === "continue" && targetRowId) {
            await supabase.from("chat_messages").update({ content: finalText }).eq("id", targetRowId);
            modelMessageId = targetRowId;
          } else if (fullText.trim()) {
            const { data: savedModel } = await supabase
              .from("chat_messages")
              .insert({
                user_id: user.id,
                business_id: conversation.business_id,
                conversation_id: conversationId,
                role: "model",
                content: fullText,
              })
              .select("id")
              .single();
            modelMessageId = savedModel?.id ?? "";
          }

          // Автозаголовок диалога по первому сообщению + всегда обновляем
          // updated_at (через триггер) — двигает диалог наверх списка в сайдбаре.
          let title: string | undefined;
          if (mode === "send" && conversation.title === "Новый чат") {
            title = autoTitle(newMessage);
            await supabase.from("chat_conversations").update({ title }).eq("id", conversationId);
          } else {
            await supabase
              .from("chat_conversations")
              .update({ title: conversation.title })
              .eq("id", conversationId);
          }

          if (modelMessageId) {
            const meta: StreamMeta = {
              conversationId,
              userMessageId,
              modelMessageId,
              title,
              appended: mode === "continue",
            };
            safeEnqueue(`${STREAM_META_MARKER}${JSON.stringify(meta)}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Ошибка при получении ответа OpenAI";
          safeEnqueue(`${STREAM_ERROR_MARKER}${msg}`);
        } finally {
          try {
            controller.close();
          } catch {
            // уже закрыт клиентом — игнорируем
          }
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof OpenAINotConfiguredError) {
      return NextResponse.json(
        { error: err.message, code: "OPENAI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка OpenAI";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
