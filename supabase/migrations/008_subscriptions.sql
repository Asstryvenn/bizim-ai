-- ============================================================
-- BIZIM — миграция: подписки/paywall (subscriptions).
-- Выполнить в Supabase SQL Editor ПОСЛЕ предыдущих миграций.
-- Ничего из существующих таблиц/политик не меняет и не удаляет —
-- только добавляет новую таблицу public.subscriptions, 1:1 с businesses.
--
-- Реальной оплаты пока нет (Kaspi/PayPal/банки подключатся позже).
-- Строка создаётся/обновляется либо DEMO-режимом (см.
-- src/lib/subscription/paymentService.ts — DemoPaymentService, вызывается
-- от имени пользователя через обычный authenticated-клиент, поэтому нужны
-- insert/update policies на "свою" запись), либо в будущем — webhook'ом
-- реального провайдера через service-role ключ (RLS для service-role не
-- применяется вообще, так что отдельная policy для этого не нужна).
-- ============================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan text not null check (plan in ('starter', 'growth', 'pro')),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'canceled', 'past_due')),
  -- 'demo' пока единственное значение; в будущем: 'kaspi' | 'paypal' | 'card' | ...
  provider text not null default 'demo',
  -- Внешний идентификатор подписки/клиента у платёжного провайдера
  -- (Stripe/Kaspi customer id и т.п.) — сейчас всегда NULL, пригодится
  -- для handleWebhook() в реальной интеграции.
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Пользователь видит/меняет подписку только своего бизнеса (business_id -> businesses.user_id = auth.uid()).
create policy "subscriptions_select_own" on public.subscriptions
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "subscriptions_insert_own" on public.subscriptions
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "subscriptions_update_own" on public.subscriptions
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists subscriptions_business_id_idx on public.subscriptions (business_id);
