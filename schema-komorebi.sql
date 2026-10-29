-- Komorebi: chạy toàn bộ file này MỘT LẦN trong Supabase → SQL Editor → Run
-- Chạy lại nhiều lần cũng không sao, dữ liệu cũ không bị mất.

-- 1) Bảng truyện
create table if not exists public.manga (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  title_key     text not null,              -- tên đã bỏ dấu, viết thường: dùng để nhận ra truyện đã có
  author        text,
  translator    text,
  release_date  date,
  status        text not null default 'dang',
  genres        text[] not null default '{}',
  description   text,
  cover_path    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, title_key)
);

-- 2) Bảng chương
create table if not exists public.chapters (
  id          uuid primary key default gen_random_uuid(),
  manga_id    uuid not null references public.manga (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number      numeric not null,
  title       text,
  pages       text[] not null default '{}',   -- đường dẫn ảnh trong kho "komorebi"
  created_at  timestamptz not null default now(),
  unique (manga_id, number)
);
create index if not exists chapters_manga_idx on public.chapters (manga_id, number);

-- 3) Mỗi tài khoản chỉ thấy và sửa được truyện của mình
alter table public.manga    enable row level security;
alter table public.chapters enable row level security;

drop policy if exists "manga cua minh"   on public.manga;
drop policy if exists "chuong cua minh"  on public.chapters;
create policy "manga cua minh"  on public.manga    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chuong cua minh" on public.chapters for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Kho ảnh riêng tư cho bìa và trang truyện
insert into storage.buckets (id, name, public)
values ('komorebi', 'komorebi', false)
on conflict (id) do nothing;

drop policy if exists "komorebi xem anh cua minh" on storage.objects;
drop policy if exists "komorebi them anh"         on storage.objects;
drop policy if exists "komorebi sua anh"          on storage.objects;
drop policy if exists "komorebi xoa anh"          on storage.objects;

create policy "komorebi xem anh cua minh" on storage.objects for select to authenticated
  using (bucket_id = 'komorebi' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "komorebi them anh" on storage.objects for insert to authenticated
  with check (bucket_id = 'komorebi' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "komorebi sua anh" on storage.objects for update to authenticated
  using (bucket_id = 'komorebi' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "komorebi xoa anh" on storage.objects for delete to authenticated
  using (bucket_id = 'komorebi' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5) Danh mục: thể loại và tiến độ (sửa được trong màn "Thể loại & tiến độ")
create table if not exists public.genres (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists genres_user_name_idx on public.genres (user_id, lower(name));

create table if not exists public.statuses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code        text not null,                -- mã lưu trong manga.status
  name        text not null,
  tone        text not null default 'green',-- màu nhãn: green, blue, purple, yellow, pink, gray
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, code)
);
create unique index if not exists statuses_user_name_idx on public.statuses (user_id, lower(name));

alter table public.genres   enable row level security;
alter table public.statuses enable row level security;
drop policy if exists "the loai cua minh" on public.genres;
drop policy if exists "tien do cua minh"  on public.statuses;
create policy "the loai cua minh" on public.genres   for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tien do cua minh"  on public.statuses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Lần đầu mở web, Komorebi sẽ tự tạo sẵn 6 tiến độ và 12 thể loại mặc định.

-- 6) Hồ sơ cá nhân, truyện yêu thích, lịch sử đọc (riêng cho từng tài khoản)
create table if not exists public.profiles (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name   text,
  birthday       date,
  bio            text,
  avatar_path    text,                       -- ảnh đại diện trong kho "komorebi"
  notif_seen_at  timestamptz,                -- lần cuối mở chuông thông báo
  updated_at     timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  manga_id    uuid not null references public.manga (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, manga_id)
);

create table if not exists public.reading_history (
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  manga_id        uuid not null references public.manga (id) on delete cascade,
  chapter_id      uuid references public.chapters (id) on delete set null,
  chapter_number  numeric,
  read_at         timestamptz not null default now(),
  primary key (user_id, manga_id)
);

alter table public.profiles        enable row level security;
alter table public.favorites       enable row level security;
alter table public.reading_history enable row level security;
drop policy if exists "ho so cua minh"     on public.profiles;
drop policy if exists "yeu thich cua minh" on public.favorites;
drop policy if exists "lich su cua minh"   on public.reading_history;
create policy "ho so cua minh"     on public.profiles        for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "yeu thich cua minh" on public.favorites       for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lich su cua minh"   on public.reading_history for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7) Nhật ký đọc từng chương (dùng cho bộ lọc theo ngày trong Lịch sử đọc)
create table if not exists public.reading_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  manga_id        uuid not null references public.manga (id) on delete cascade,
  chapter_id      uuid references public.chapters (id) on delete set null,
  chapter_number  numeric,
  read_at         timestamptz not null default now()
);
create index if not exists reading_log_user_time_idx on public.reading_log (user_id, read_at desc);
alter table public.reading_log enable row level security;
drop policy if exists "nhat ky cua minh" on public.reading_log;
create policy "nhat ky cua minh" on public.reading_log for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8) PHÂN QUYỀN: người đăng truyện (uploader) và tài khoản chỉ đọc (reader)
--    Thư viện giờ dùng chung: mọi tài khoản đều đọc được, chỉ uploader mới đăng / sửa truyện và danh mục.
create table if not exists public.user_roles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'reader' check (role in ('uploader', 'reader')),
  created_at  timestamptz not null default now()
);
alter table public.user_roles enable row level security;
drop policy if exists "xem quyen cua minh" on public.user_roles;
create policy "xem quyen cua minh" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.is_uploader() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'uploader');
$$;
grant execute on function public.is_uploader() to authenticated;

-- Tài khoản tạo đầu tiên (chủ web) được quyền đăng truyện; các tài khoản còn lại mặc định chỉ đọc
insert into public.user_roles (user_id, role)
select id, 'uploader' from auth.users order by created_at asc limit 1
on conflict (user_id) do nothing;
insert into public.user_roles (user_id, role) select id, 'reader' from auth.users
on conflict (user_id) do nothing;

-- Tài khoản tạo mới về sau tự động là "chỉ đọc"
create or replace function public.handle_new_user_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'reader') on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role after insert on auth.users for each row execute function public.handle_new_user_role();

-- Truyện, chương, thể loại, tiến độ: ai cũng xem được, chỉ uploader được ghi
drop policy if exists "manga cua minh"   on public.manga;
drop policy if exists "chuong cua minh"  on public.chapters;
drop policy if exists "the loai cua minh" on public.genres;
drop policy if exists "tien do cua minh"  on public.statuses;
do $$
declare t text;
begin
  foreach t in array array['manga', 'chapters', 'genres', 'statuses'] loop
    execute format('drop policy if exists "doc chung" on public.%I', t);
    execute format('drop policy if exists "uploader them" on public.%I', t);
    execute format('drop policy if exists "uploader sua" on public.%I', t);
    execute format('drop policy if exists "uploader xoa" on public.%I', t);
    execute format('create policy "doc chung" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "uploader them" on public.%I for insert to authenticated with check (public.is_uploader() and auth.uid() = user_id)', t);
    execute format('create policy "uploader sua" on public.%I for update to authenticated using (public.is_uploader()) with check (public.is_uploader())', t);
    execute format('create policy "uploader xoa" on public.%I for delete to authenticated using (public.is_uploader())', t);
  end loop;
end $$;

-- Tên truyện, thể loại, tiến độ không trùng trên toàn thư viện
create unique index if not exists manga_title_key_all_idx on public.manga (title_key);
create unique index if not exists genres_name_all_idx     on public.genres (lower(name));
create unique index if not exists statuses_code_all_idx   on public.statuses (code);
create unique index if not exists statuses_name_all_idx   on public.statuses (lower(name));

-- Kho ảnh: ai đăng nhập cũng xem được; uploader đăng ảnh truyện; ai cũng tự đổi được ảnh đại diện của mình
drop policy if exists "komorebi xem anh cua minh" on storage.objects;
drop policy if exists "komorebi them anh"         on storage.objects;
drop policy if exists "komorebi sua anh"          on storage.objects;
drop policy if exists "komorebi xoa anh"          on storage.objects;
drop policy if exists "komorebi xem anh"          on storage.objects;
drop policy if exists "komorebi dang anh"         on storage.objects;
drop policy if exists "komorebi doi anh"          on storage.objects;
drop policy if exists "komorebi go anh"           on storage.objects;
create policy "komorebi xem anh" on storage.objects for select to authenticated using (bucket_id = 'komorebi');
create policy "komorebi dang anh" on storage.objects for insert to authenticated with check (
  bucket_id = 'komorebi' and (storage.foldername(name))[1] = auth.uid()::text
  and (public.is_uploader() or storage.filename(name) like 'avatar-%'));
create policy "komorebi doi anh" on storage.objects for update to authenticated using (
  bucket_id = 'komorebi' and (public.is_uploader() or ((storage.foldername(name))[1] = auth.uid()::text and storage.filename(name) like 'avatar-%')));
create policy "komorebi go anh" on storage.objects for delete to authenticated using (
  bucket_id = 'komorebi' and (public.is_uploader() or ((storage.foldername(name))[1] = auth.uid()::text and storage.filename(name) like 'avatar-%')));

-- Cấp quyền đăng truyện cho tài khoản khác (đổi email rồi chạy riêng câu này):
-- update public.user_roles set role = 'uploader' where user_id = (select id from auth.users where email = 'ban-be@gmail.com');
-- Thu hồi về chỉ đọc:
-- update public.user_roles set role = 'reader'   where user_id = (select id from auth.users where email = 'ban-be@gmail.com');
