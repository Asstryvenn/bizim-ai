-- ============================================================
-- BIZIM final-mvp — переход supply chain модуля на реальные данные
-- Выполнить в Supabase SQL Editor ПОСЛЕ 010_businesses_user_id_unique.sql.
--
-- Контекст: инструменты остатков/поставщиков ранее были устроены так, что
-- пользователь мог только вручную ввести price_index/avg_delivery_days/
-- delay_rate поставщика (числа, которые никто не может честно знать про
-- нового поставщика — по сути, придуманные значения) и avg_daily_usage
-- товара "на глаз". Эта миграция добавляет реальный источник данных
-- (продажи) и убирает "придуманные по умолчанию" числа у поставщиков —
-- теперь эти метрики либо считаются из реальной истории заказов, либо
-- честно показываются как "недостаточно данных". Ничего не удаляет.
-- ============================================================

-- ---------- SALES: реальная история продаж по товару ----------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric not null,
  unit_price numeric,
  total_amount numeric,
  sold_at timestamptz not null,
  -- 'excel_import' | 'manual' — как эта строка попала в систему; ни одна
  -- строка sales никогда не создаётся синтетически (никаких demo-сидов).
  source text not null default 'manual' check (source in ('excel_import', 'manual')),
  created_at timestamptz not null default now()
);

alter table public.sales enable row level security;

create policy "sales_select_own" on public.sales
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "sales_insert_own" on public.sales
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "sales_delete_own" on public.sales
  for delete using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists sales_product_id_sold_at_idx on public.sales (product_id, sold_at desc);
create index if not exists sales_business_id_sold_at_idx on public.sales (business_id, sold_at desc);

-- ---------- PRODUCTS (inventory_items): поля для реальной аналитики ----------
alter table public.inventory_items
  add column if not exists sku text,
  add column if not exists purchase_price numeric,
  add column if not exists selling_price numeric,
  -- Рассчитывается из sales (см. src/lib/salesAnalytics.ts) при импорте/пересчёте.
  -- NULL, пока нет истории продаж — отличает "посчитано" от avg_daily_usage,
  -- которое пользователь мог ввести вручную "на глаз".
  add column if not exists forecast_daily_usage numeric,
  add column if not exists days_of_stock numeric,
  add column if not exists last_purchase_at timestamptz;

-- ---------- SUPPLIERS: убираем "придуманные по умолчанию" метрики ----------
-- price_index/avg_delivery_days/delay_rate раньше были NOT NULL с дефолтами
-- (100 / 2 / 0) — то есть каждый новый поставщик тут же получал вид "уже
-- проверенного" со случайными на самом деле цифрами. Теперь они nullable и
-- без дефолта: реальные значения либо считаются из purchase_orders (см.
-- computeSupplierMetrics в src/lib/supplyChain.ts), либо остаются NULL и UI
-- честно показывает "недостаточно данных".
alter table public.suppliers
  alter column price_index drop not null,
  alter column price_index drop default,
  alter column avg_delivery_days drop not null,
  alter column avg_delivery_days drop default,
  alter column delay_rate drop not null,
  alter column delay_rate drop default;

alter table public.suppliers
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists address text;
