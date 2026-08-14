-- ============================================================
-- BIZIM final-mvp — уникальность businesses.user_id
-- Выполнить в Supabase SQL Editor ПОСЛЕ 009_supply_chain.sql.
--
-- Нужна для идемпотентного создания business profile после подтверждения
-- email (см. src/app/auth/callback/route.ts и src/lib/registration.ts):
-- повторный переход по confirmation-ссылке или гонка между callback и
-- API-роутом регистрации не должны создавать вторую строку businesses
-- для одного и того же пользователя. Ничего из существующих данных не
-- удаляет и не меняет.
-- ============================================================

create unique index if not exists businesses_user_id_key on public.businesses (user_id);
