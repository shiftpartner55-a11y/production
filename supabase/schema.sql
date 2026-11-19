-- =====================================================================
-- Shiftingpartner — Supabase schema, RLS policies and storage
-- Run once in Supabase Dashboard > SQL Editor (safe to re-run).
-- NOTE: There is intentionally NO leads table. Consultation and contact
-- submissions go to Google Sheets via the submit-lead Edge Function.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users (id) on delete cascade,
  email         text not null unique,
  role          text not null default 'admin' check (role in ('admin', 'editor')),
  created_at    timestamptz not null default now()
);

create table if not exists public.blog_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 3 and 200),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  excerpt          text check (char_length(excerpt) <= 400),
  content          text not null default '',
  featured_image   text,
  image_alt        text,
  og_image         text,
  category_id      uuid references public.blog_categories (id) on delete set null,
  author           text default 'Shiftingpartner Team',
  status           text not null default 'draft' check (status in ('draft', 'published', 'scheduled')),
  seo_title        text check (char_length(seo_title) <= 70),
  meta_description text check (char_length(meta_description) <= 170),
  focus_keyword    text,
  canonical_url    text,
  reading_time     integer not null default 1,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  constraint published_needs_date check (status = 'draft' or published_at is not null)
);

create index if not exists blog_posts_public_idx on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts (category_id);

create table if not exists public.blog_tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 50),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table if not exists public.blog_post_tags (
  blog_id uuid not null references public.blog_posts (id) on delete cascade,
  tag_id  uuid not null references public.blog_tags (id) on delete cascade,
  primary key (blog_id, tag_id)
);
create index if not exists blog_post_tags_tag_idx on public.blog_post_tags (tag_id);

-- ---------------------------------------------------------------------
-- Helpers & triggers
-- ---------------------------------------------------------------------
-- Is the current user an authorised admin? SECURITY DEFINER so it can read admin_users under RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where auth_user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.blog_posts_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  words integer;
begin
  new.updated_at := now();
  -- reading time: ~200 words per minute, HTML tags stripped
  words := coalesce(array_length(regexp_split_to_array(trim(regexp_replace(coalesce(new.content, ''), '<[^>]+>', ' ', 'g')), '\s+'), 1), 0);
  new.reading_time := greatest(1, ceil(words / 200.0)::int);
  if new.status in ('published', 'scheduled') and new.published_at is null then
    new.published_at := now();
  end if;
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists blog_posts_before_write on public.blog_posts;
create trigger blog_posts_before_write
  before insert or update on public.blog_posts
  for each row execute function public.blog_posts_before_write();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.admin_users     enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_posts      enable row level security;
alter table public.blog_tags       enable row level security;
alter table public.blog_post_tags  enable row level security;

-- admin_users: an admin can see the admin list; nobody can write through the API
-- (add admins with the SQL in README / supabase/create-admin.sql).
drop policy if exists "admins read admin_users" on public.admin_users;
create policy "admins read admin_users" on public.admin_users
  for select to authenticated using (public.is_admin() or auth_user_id = auth.uid());

-- blog_posts: public reads published (or scheduled & due) posts; admins do everything
drop policy if exists "public read published posts" on public.blog_posts;
create policy "public read published posts" on public.blog_posts
  for select to anon, authenticated
  using ((status in ('published', 'scheduled') and published_at <= now()) or public.is_admin());

drop policy if exists "admins insert posts" on public.blog_posts;
create policy "admins insert posts" on public.blog_posts
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update posts" on public.blog_posts;
create policy "admins update posts" on public.blog_posts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete posts" on public.blog_posts;
create policy "admins delete posts" on public.blog_posts
  for delete to authenticated using (public.is_admin());

-- blog_categories & blog_tags: public read, admin write
drop policy if exists "public read categories" on public.blog_categories;
create policy "public read categories" on public.blog_categories for select to anon, authenticated using (true);
drop policy if exists "admins write categories" on public.blog_categories;
create policy "admins write categories" on public.blog_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read tags" on public.blog_tags;
create policy "public read tags" on public.blog_tags for select to anon, authenticated using (true);
drop policy if exists "admins write tags" on public.blog_tags;
create policy "admins write tags" on public.blog_tags for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- blog_post_tags: visible only when the linked post is visible
drop policy if exists "public read post tags" on public.blog_post_tags;
create policy "public read post tags" on public.blog_post_tags for select to anon, authenticated
  using (exists (select 1 from public.blog_posts p where p.id = blog_id
                 and ((p.status in ('published', 'scheduled') and p.published_at <= now()) or public.is_admin())));
drop policy if exists "admins write post tags" on public.blog_post_tags;
create policy "admins write post tags" on public.blog_post_tags for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Table privileges (RLS still applies on top of these)
grant usage on schema public to anon, authenticated;
grant select on public.blog_posts, public.blog_categories, public.blog_tags, public.blog_post_tags to anon;
grant select, insert, update, delete on public.blog_posts, public.blog_categories, public.blog_tags, public.blog_post_tags to authenticated;
grant select on public.admin_users to authenticated;
revoke insert, update, delete on public.admin_users from anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: blog-images bucket (public read, admin-only write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read blog images" on storage.objects;
create policy "public read blog images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'blog-images');

drop policy if exists "admins upload blog images" on storage.objects;
create policy "admins upload blog images" on storage.objects
  for insert to authenticated with check (bucket_id = 'blog-images' and public.is_admin());

drop policy if exists "admins update blog images" on storage.objects;
create policy "admins update blog images" on storage.objects
  for update to authenticated using (bucket_id = 'blog-images' and public.is_admin())
  with check (bucket_id = 'blog-images' and public.is_admin());

drop policy if exists "admins delete blog images" on storage.objects;
create policy "admins delete blog images" on storage.objects
  for delete to authenticated using (bucket_id = 'blog-images' and public.is_admin());

-- ---------------------------------------------------------------------
-- Default categories
-- ---------------------------------------------------------------------
insert into public.blog_categories (name, slug, description) values
  ('Moving Tips', 'moving-tips', 'Practical advice for planning a smooth house move.'),
  ('Packing Guides', 'packing-guides', 'How to pack furniture, kitchenware, fragile items and more.'),
  ('Household Relocation', 'household-relocation', 'Guides to local and intercity household relocation.'),
  ('City Guides', 'city-guides', 'Local moving insights for our seven service cities.'),
  ('Storage & Moving Advice', 'storage-moving-advice', 'Storage, decluttering and moving-day advice.')
on conflict (slug) do nothing;
