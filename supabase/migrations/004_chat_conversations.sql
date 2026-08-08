-- ============================================================
-- BIZIM — миграция: история диалогов AI Chat (conversations)
-- Выполнить в Supabase SQL Editor ПОСЛЕ предыдущих миграций.
-- Ничего из существующих таблиц/политик не меняет и не удаляет —
-- добавляет таблицу chat_conversations и связывает с ней
-- уже существующую chat_messages через новую nullable-колонку
-- conversation_id (старые сообщения без диалога продолжают работать).
-- ============================================================

-- ---------- CHAT CONVERSATIONS ----------
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null default 'Новый чат',
  pinned boolean not null default false,
  -- share_id выдаётся только когда включён шаринг; уникален, но может быть NULL
  -- у большинства диалогов, поэтому обычный unique-констрейнт (не частичный
  -- индекс) не подойдёт — NULL в Postgres не конфликтует сам с собой, так
  -- что unique здесь и так безопасен для множества NULL.
  share_id uuid unique,
  shared boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.chat_conversations enable row level security;

create policy "chat_conversations_select_own" on public.chat_conversations
  for select using (auth.uid() = user_id);
create policy "chat_conversations_insert_own" on public.chat_conversations
  for insert with check (auth.uid() = user_id);
create policy "chat_conversations_update_own" on public.chat_conversations
  for update using (auth.uid() = user_id);
create policy "chat_conversations_delete_own" on public.chat_conversations
  for delete using (auth.uid() = user_id);

create index if not exists chat_conversations_business_id_idx
  on public.chat_conversations (business_id, pinned desc, updated_at desc);

drop trigger if exists trg_chat_conversations_updated_at on public.chat_conversations;
create trigger trg_chat_conversations_updated_at
  before update on public.chat_conversations
  for each row execute function public.set_updated_at();

-- ---------- ССЫЛКА ИЗ chat_messages НА ДИАЛОГ ----------
alter table public.chat_messages
  add column if not exists conversation_id uuid references public.chat_conversations(id) on delete cascade;

create index if not exists chat_messages_conversation_id_idx
  on public.chat_messages (conversation_id, created_at);

-- ---------- ПУБЛИЧНЫЙ ДОСТУП К РАСШАРЕННЫМ ДИАЛОГАМ ----------
-- "Share Chat" читается анонимными посетителями по прямой ссылке через
-- API-роут с Service Role ключом (обходит RLS на сервере, см.
-- src/app/share/[shareId]/page.tsx), поэтому отдельная anon-политика
-- на select здесь не нужна и не добавляется — доступ строго read-only
-- и только по совпадению share_id + share_enabled = true.
