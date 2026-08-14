-- ============================================================
-- BIZIM final-mvp — снабжение и логистика (SERPIN BUSINESS TOURNAMENT)
-- Выполнить в Supabase SQL Editor ПОСЛЕ предыдущих миграций (002-008).
-- Ничего из существующих таблиц/политик не меняет и не удаляет —
-- добавляет 6 новых таблиц для модуля учёта остатков, поставщиков,
-- заказов и автозаказа.
-- ============================================================

-- ---------- SUPPLIERS ----------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Поставщики',
  -- Относительный индекс цены (100 = средняя цена по рынку), не абсолютная сумма —
  -- достаточно для scoring-сравнения поставщиков в MVP.
  price_index numeric not null default 100,
  avg_delivery_days numeric not null default 2,
  -- Доля сорванных/задержанных поставок, 0..1.
  delay_rate numeric not null default 0 check (delay_rate >= 0 and delay_rate <= 1),
  orders_count int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy "suppliers_select_own" on public.suppliers
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "suppliers_insert_own" on public.suppliers
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "suppliers_update_own" on public.suppliers
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "suppliers_delete_own" on public.suppliers
  for delete using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists suppliers_business_id_idx on public.suppliers (business_id);

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------- INVENTORY ITEMS ----------
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Общее',
  unit text not null default 'шт',
  current_stock numeric not null default 0,
  min_stock numeric not null default 0,
  -- Желаемый запас при автозаказе (сколько должно остаться "с запасом" после доставки).
  desired_stock numeric not null default 0,
  avg_daily_usage numeric not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;

create policy "inventory_items_select_own" on public.inventory_items
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "inventory_items_insert_own" on public.inventory_items
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "inventory_items_update_own" on public.inventory_items
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "inventory_items_delete_own" on public.inventory_items
  for delete using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists inventory_items_business_id_idx on public.inventory_items (business_id);
create index if not exists inventory_items_supplier_id_idx on public.inventory_items (supplier_id);

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ---------- PURCHASE ORDERS ----------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'confirmed', 'in_transit', 'delivered', 'delayed')),
  total_amount numeric not null default 0,
  expected_delivery date,
  actual_delivery date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.purchase_orders enable row level security;

create policy "purchase_orders_select_own" on public.purchase_orders
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "purchase_orders_insert_own" on public.purchase_orders
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "purchase_orders_update_own" on public.purchase_orders
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists purchase_orders_business_id_idx on public.purchase_orders (business_id, created_at desc);
create index if not exists purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);

drop trigger if exists trg_purchase_orders_updated_at on public.purchase_orders;
create trigger trg_purchase_orders_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

-- ---------- PURCHASE ORDER ITEMS ----------
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric not null,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.purchase_order_items enable row level security;

create policy "purchase_order_items_select_own" on public.purchase_order_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      join public.businesses b on b.id = po.business_id
      where po.id = order_id and b.user_id = auth.uid()
    )
  );
create policy "purchase_order_items_insert_own" on public.purchase_order_items
  for insert with check (
    exists (
      select 1 from public.purchase_orders po
      join public.businesses b on b.id = po.business_id
      where po.id = order_id and b.user_id = auth.uid()
    )
  );

create index if not exists purchase_order_items_order_id_idx on public.purchase_order_items (order_id);

-- ---------- ACTIVITY LOG ----------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  action text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "activity_log_select_own" on public.activity_log
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "activity_log_insert_own" on public.activity_log
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists activity_log_business_id_idx on public.activity_log (business_id, created_at desc);

-- ---------- BUSINESS TOOLS (каталог инструментов: активация/избранное) ----------
create table if not exists public.business_tools (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  tool_key text not null,
  is_favorite boolean not null default false,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, tool_key)
);

alter table public.business_tools enable row level security;

create policy "business_tools_select_own" on public.business_tools
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "business_tools_insert_own" on public.business_tools
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "business_tools_update_own" on public.business_tools
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

create index if not exists business_tools_business_id_idx on public.business_tools (business_id);

drop trigger if exists trg_business_tools_updated_at on public.business_tools;
create trigger trg_business_tools_updated_at
  before update on public.business_tools
  for each row execute function public.set_updated_at();
