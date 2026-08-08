-- ============================================================
-- BIZIM — схема базы данных Supabase
-- Выполнить целиком в Supabase SQL Editor
-- ============================================================

-- ---------- BUSINESSES ----------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  business_name text not null,
  business_type text not null,
  city text not null,
  employees_count int not null default 0,
  clients_today int not null default 0,
  clients_week int not null default 0,
  clients_month int not null default 0,
  clients_year int not null default 0,
  main_problem text,
  average_check numeric not null default 0,
  work_hours_from text,
  work_hours_to text,
  peak_hours text,
  last_analysis text,
  last_analysis_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

create policy "businesses_select_own" on public.businesses
  for select using (auth.uid() = user_id);
create policy "businesses_insert_own" on public.businesses
  for insert with check (auth.uid() = user_id);
create policy "businesses_update_own" on public.businesses
  for update using (auth.uid() = user_id);
create policy "businesses_delete_own" on public.businesses
  for delete using (auth.uid() = user_id);

-- ---------- IMPORTED FILES ----------
create table if not exists public.imported_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  file_name text not null,
  file_type text not null, -- csv | xlsx | json
  row_count int not null default 0,
  parsed_data jsonb not null, -- массив строк как объектов
  created_at timestamptz not null default now()
);

alter table public.imported_files enable row level security;

create policy "imported_files_select_own" on public.imported_files
  for select using (auth.uid() = user_id);
create policy "imported_files_insert_own" on public.imported_files
  for insert with check (auth.uid() = user_id);
create policy "imported_files_delete_own" on public.imported_files
  for delete using (auth.uid() = user_id);

-- ---------- AI ANALYSES ----------
create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_file_id uuid references public.imported_files(id) on delete set null,
  report text not null, -- реальный ответ OpenAI
  raw_stats jsonb, -- посчитанные на нашей стороне метрики, переданные в промпт
  created_at timestamptz not null default now()
);

alter table public.ai_analyses enable row level security;

create policy "ai_analyses_select_own" on public.ai_analyses
  for select using (auth.uid() = user_id);
create policy "ai_analyses_insert_own" on public.ai_analyses
  for insert with check (auth.uid() = user_id);

-- ---------- AI CHAT MESSAGES ----------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null check (role in ('user','model')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat_messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_businesses_updated_at on public.businesses;
create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();
