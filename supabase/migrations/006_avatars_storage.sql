-- ============================================================
-- BIZIM — миграция: Storage-бакет "avatars" для аватарок профиля
-- Выполнить в Supabase SQL Editor ПОСЛЕ 005_avatar_url.sql.
-- Ничего из существующих таблиц/политик не меняет и не удаляет —
-- только создаёт публичный бакет avatars и RLS-политики на storage.objects,
-- ограничивающие запись папкой текущего пользователя (auth.uid()).
--
-- ЗАЧЕМ: раньше файл аватарки кодировался в base64 и целиком записывался
-- в businesses.avatar_url (текстовая колонка) — рабочий, но тяжёлый способ:
-- десятки килобайт текста на каждое чтение/сохранение профиля. Теперь файл
-- загружается через POST /api/settings/avatar (multipart/form-data, тело
-- запроса — НЕ headers/cookies/JWT), кладётся в Storage, а в
-- businesses.avatar_url сохраняется только короткая public-ссылка.
--
-- Идемпотентность: insert ... on conflict do nothing для бакета и
-- drop policy if exists + create policy для политик — миграцию можно
-- безопасно перезапускать повторно.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Файлы хранятся по пути "<user_id>/avatar.jpg" — первая часть пути должна
-- совпадать с auth.uid() загружающего пользователя.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Бакет публичный (public = true), поэтому чтение файлов идёт напрямую по
-- public URL и не требует отдельной select-политики для отображения аватарок,
-- но политика на select добавлена явно — на случай приватного листинга.
drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects for select to public
  using (bucket_id = 'avatars');
