-- ============================================================
-- BIZIM — миграция: роли и Admin Panel
-- Выполнить в Supabase SQL Editor ПОСЛЕ schema.sql и 002_growth_tools.sql
-- Ничего из существующих таблиц/политик не меняет и не удаляет —
-- только добавляет колонку role и индекс по ней.
-- ============================================================

alter table public.businesses
  add column if not exists role text not null default 'user'
  check (role in ('admin', 'user'));

create index if not exists businesses_role_idx on public.businesses (role);

-- Чтобы назначить первого администратора, выполните вручную (замените email):
-- update public.businesses set role = 'admin'
-- where user_id = (select id from auth.users where email = 'you@example.com');
