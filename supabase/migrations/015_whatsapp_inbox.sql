-- ============================================================
-- BIZIM final-mvp — WhatsApp inbox: реальные входящие/исходящие диалоги
-- через WhatsApp Cloud API (отдельно от AI-чата chat_conversations/
-- chat_messages, у которых другая семантика role/share).
-- Выполнить ПОСЛЕ 014_business_profile_whatsapp_orders.sql.
-- Ничего не удаляет.
-- ============================================================

-- Привязка business -> конкретный WhatsApp phone_number_id (Meta). Нужна,
-- чтобы webhook мог понять, какому бизнесу принадлежит входящее сообщение
-- (WABA номер сейчас один на деплой, но явная привязка честнее угадывания).
alter table public.businesses
  add column if not exists whatsapp_phone_number_id text;

-- ---------- WHATSAPP CONVERSATIONS ----------
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_phone text not null,
  contact_name text,
  whatsapp_phone_number_id text,
  last_message_at timestamptz,
  last_message_preview text,
  -- Кол-во непрочитанных ВХОДЯЩИХ сообщений; сбрасывается в 0, когда
  -- пользователь открывает диалог в интерфейсе.
  unread_count int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, customer_phone)
);

alter table public.whatsapp_conversations enable row level security;

create policy "whatsapp_conversations_select_own" on public.whatsapp_conversations
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "whatsapp_conversations_insert_own" on public.whatsapp_conversations
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "whatsapp_conversations_update_own" on public.whatsapp_conversations
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists whatsapp_conversations_business_id_idx on public.whatsapp_conversations (business_id);

drop trigger if exists trg_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger trg_whatsapp_conversations_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at();

-- ---------- WHATSAPP MESSAGES ----------
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  -- Дублируем business_id — упрощает RLS-политики и запросы без join.
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- id сообщения от Meta (wamid...). Уникален у Meta глобально, но unique
  -- ставим per-business на случай коллизий тестовых payload между аккаунтами.
  wa_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text'
    check (message_type in ('text', 'image', 'audio', 'document', 'video', 'sticker', 'location', 'contacts', 'unknown')),
  content text,
  -- Media id от Graph API для не-текстовых типов — сами файлы не скачиваем
  -- и не хостим, только честно храним ссылку на media id.
  media_id text,
  status text not null default 'received'
    check (status in ('received', 'sent', 'delivered', 'read', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_messages enable row level security;

create policy "whatsapp_messages_select_own" on public.whatsapp_messages
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "whatsapp_messages_insert_own" on public.whatsapp_messages
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "whatsapp_messages_update_own" on public.whatsapp_messages
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists whatsapp_messages_conversation_id_idx on public.whatsapp_messages (conversation_id);
create index if not exists whatsapp_messages_business_id_idx on public.whatsapp_messages (business_id);
-- Дедупликация повторных webhook-доставок одного и того же сообщения Meta.
create unique index if not exists whatsapp_messages_business_wa_message_id_idx
  on public.whatsapp_messages (business_id, wa_message_id)
  where wa_message_id is not null;
