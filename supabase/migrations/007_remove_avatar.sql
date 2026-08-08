-- ============================================================
-- BIZIM — миграция: полное удаление функциональности аватарок.
-- Выполнить в Supabase SQL Editor ПОСЛЕ 006_avatars_storage.sql.
--
-- Аватарка больше не нужна продукту. Убираем:
--   1) Storage-политики и бакет "avatars" (файлы аватарок).
--   2) Колонку public.businesses.avatar_url.
--   3) Ключ avatar_url/avatarUrl из auth.users.raw_user_meta_data
--      (на случай старых аккаунтов, где он ещё остался — именно это
--      раздутое поле в JWT/cookie было причиной HTTP 431 и белого экрана).
--
-- Ничего из first_name/last_name/email/business_name и остальных таблиц
-- (chat, chat_conversations, chat_messages, businesses и т.д.) не трогает.
-- Пользователи и их данные не удаляются.
-- ============================================================

-- 1) Storage: политики и бакет avatars
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
drop policy if exists "avatars_select_public" on storage.objects;

delete from storage.objects where bucket_id = 'avatars';
delete from storage.buckets where id = 'avatars';

-- 2) Колонка avatar_url в businesses
alter table public.businesses
  drop column if exists avatar_url;

-- 3) Остатки avatar_url/avatarUrl в user_metadata (если есть у старых аккаунтов)
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'avatar_url' - 'avatarUrl'
where raw_user_meta_data ? 'avatar_url' or raw_user_meta_data ? 'avatarUrl';
