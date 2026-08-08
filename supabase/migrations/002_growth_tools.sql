-- ============================================================
-- BIZIM — миграция: AI-инструменты для развития бизнеса
-- Выполнить в Supabase SQL Editor ПОСЛЕ основного schema.sql
-- Ничего из существующих таблиц/политик не меняет и не удаляет.
-- ============================================================

create table if not exists public.growth_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  analysis_id uuid references public.ai_analyses(id) on delete set null,
  tool_type text not null check (
    tool_type in (
      'promo',
      'instagram_post',
      'tiktok_script',
      'loyalty_program',
      'coupon',
      'sms',
      'profit_tips'
    )
  ),
  title text not null, -- реальный ответ OpenAI: заголовок сгенерированного результата
  content jsonb not null, -- реальный ответ OpenAI: { sections: [{ label, content }] }
  created_at timestamptz not null default now()
);

alter table public.growth_tools enable row level security;

create policy "growth_tools_select_own" on public.growth_tools
  for select using (auth.uid() = user_id);
create policy "growth_tools_insert_own" on public.growth_tools
  for insert with check (auth.uid() = user_id);

create index if not exists growth_tools_business_id_idx on public.growth_tools (business_id);
create index if not exists growth_tools_analysis_id_idx on public.growth_tools (analysis_id);
