-- ============================================================
-- BIZIM — миграция: avatar_url в таблице businesses
-- Выполнить в Supabase SQL Editor ПОСЛЕ предыдущих миграций.
-- Ничего из существующих таблиц/политик не меняет и не удаляет —
-- только добавляет nullable-колонку avatar_url.
--
-- ПОЧЕМУ ЭТА МИГРАЦИЯ НУЖНА (первопричина HTTP 431):
-- Раньше SettingsForm писал аватар (base64 data URL, десятки килобайт)
-- в supabase.auth.updateUser({ data: { avatar_url } }) — т.е. в
-- user_metadata. Supabase Auth встраивает user_metadata целиком в JWT,
-- а JWT — это и есть auth-cookie (sb-*-auth-token, при большом размере
-- разбивается на несколько чанков-cookie). Один большой аватар в
-- user_metadata раздувал итоговый Cookie/Set-Cookie заголовок до
-- десятков килобайт, что превышает лимит заголовков большинства
-- серверов/прокси — отсюда "431 Request Header Fields Too Large" сразу
-- после login (новый токен снова embed'ит тот же раздутый metadata) и
-- после сохранения в Settings (обновлённый токен получает ещё больший
-- metadata). Обычная колонка в businesses в auth-cookie не попадает.
-- ============================================================

alter table public.businesses
  add column if not exists avatar_url text;

-- Опционально: если у вас уже есть аккаунт(ы), сломанные раздутым
-- user_metadata.avatar_url (страницы не открываются с 431 даже до входа
-- в Settings), выполните ОДИН РАЗ вручную в SQL Editor, чтобы вернуть
-- доступ — это не часть автоматической миграции и ничего не удаляет,
-- кроме самого поля avatar_url из user_metadata:
--
-- update auth.users
-- set raw_user_meta_data = raw_user_meta_data - 'avatar_url'
-- where email = 'you@example.com';
