-- ============================================================
-- BIZIM final-mvp — реальный профиль бизнеса, WhatsApp-заказы, честные
-- статусы, расширенный activity_log.
-- Выполнить ПОСЛЕ 013_nullable_stock_and_import_links.sql.
-- Ничего не удаляет, только добавляет nullable-поля с честными дефолтами.
-- ============================================================

-- ---------- BUSINESSES: реальный адрес и контакты бизнеса ----------
alter table public.businesses
  add column if not exists country text,
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists phone text,
  add column if not exists whatsapp_phone text,
  add column if not exists currency text not null default 'KZT',
  -- Свободный текст, когда business_type = 'other' — не подменяет сам тип.
  add column if not exists business_type_other text;

-- ---------- SUPPLIERS: реальные контакты, никаких выдуманных метрик ----------
alter table public.suppliers
  add column if not exists whatsapp_phone text,
  add column if not exists city text,
  add column if not exists notes text;

-- ---------- PURCHASE ORDERS: internal vs external vs payment status ----------
-- Раньше единственный "status" смешивал "что пользователь отметил внутри
-- Bizim" и "что реально произошло у поставщика" — из-за этого прогресс-бар
-- выглядел как подтверждённая доставка, хотя это была просто ручная
-- пометка. Теперь это разделено:
--   status          — внутренний статус (как раньше: draft/sent/confirmed/
--                     in_transit/delivered/delayed), пользователь двигает
--                     его вручную кнопкой "Отметить вручную".
--   external_status — что РЕАЛЬНО подтверждено внешней системой
--                     (сейчас только WhatsApp Cloud API): null, пока ничего
--                     не отправлено; 'sent_via_whatsapp' только после
--                     успешного ответа Meta Graph API.
--   payment_status  — 'unpaid' всегда, пока нет реального payment provider;
--                     'paid' зарезервировано на будущее, никогда не
--                     проставляется автоматически.
alter table public.purchase_orders
  add column if not exists external_status text
    check (external_status is null or external_status in ('sent_via_whatsapp', 'confirmed_by_supplier')),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid')),
  add column if not exists whatsapp_message_id text,
  add column if not exists sent_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- ---------- ACTIVITY LOG: структурированная история действий ----------
alter table public.activity_log
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists metadata jsonb;
