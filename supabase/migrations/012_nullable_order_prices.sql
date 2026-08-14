-- ============================================================
-- BIZIM final-mvp — честная цена в заказах
-- Выполнить ПОСЛЕ 011_real_data_model.sql.
--
-- purchase_order_items.unit_price и purchase_orders.total_amount были
-- NOT NULL с дефолтом 0 — это означало, что при неизвестной цене заказ
-- молча показывал "0 ₸" вместо честного "цена не указана". Теперь both
-- nullable: NULL значит "цена ещё не подтверждена поставщиком", а не "0".
-- ============================================================

alter table public.purchase_order_items
  alter column unit_price drop not null,
  alter column unit_price drop default;

alter table public.purchase_orders
  alter column total_amount drop not null,
  alter column total_amount drop default;
