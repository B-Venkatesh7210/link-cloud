-- LinkCloud MVP schema: personal profiles, links, and tags with RLS
-- Extension for gen_random_uuid (usually enabled by default on Supabase)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_created_at_idx on public.profiles (created_at);

-- ---------------------------------------------------------------------------
-- links
-- ---------------------------------------------------------------------------
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  normalized_url text not null,
  label text not null,
  page_title text,
  hostname text not null,
  description text,
  notes text,
  favicon_url text,
  position_x double precision not null,
  position_y double precision not null,
  visual_seed integer not null,
  open_count integer not null default 0,
  last_opened_at timestamptz,
  is_favorite boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint links_open_count_nonnegative check (open_count >= 0)
);

create unique index if not exists links_user_normalized_url_uidx
  on public.links (user_id, normalized_url);

create index if not exists links_user_id_idx on public.links (user_id);
create index if not exists links_user_archived_idx on public.links (user_id, archived_at);
create index if not exists links_user_favorite_idx on public.links (user_id, is_favorite);
create index if not exists links_hostname_idx on public.links (hostname);
create index if not exists links_created_at_idx on public.links (created_at desc);

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists tags_user_normalized_name_uidx
  on public.tags (user_id, normalized_name);

create index if not exists tags_user_id_idx on public.tags (user_id);

-- ---------------------------------------------------------------------------
-- link_tags
-- ---------------------------------------------------------------------------
create table if not exists public.link_tags (
  link_id uuid not null references public.links (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (link_id, tag_id)
);

create index if not exists link_tags_tag_id_idx on public.link_tags (tag_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists links_set_updated_at on public.links;
create trigger links_set_updated_at
  before update on public.links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create / update profile from auth.users
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile in sync when Google metadata changes on subsequent logins
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    full_name = coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      full_name
    ),
    avatar_url = coalesce(new.raw_user_meta_data ->> 'avatar_url', avatar_url),
    updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.links enable row level security;
alter table public.tags enable row level security;
alter table public.link_tags enable row level security;

-- profiles policies
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- links policies
drop policy if exists "Users can read own links" on public.links;
create policy "Users can read own links"
  on public.links for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own links" on public.links;
create policy "Users can insert own links"
  on public.links for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own links" on public.links;
create policy "Users can update own links"
  on public.links for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own links" on public.links;
create policy "Users can delete own links"
  on public.links for delete
  using (auth.uid() = user_id);

-- tags policies
drop policy if exists "Users can read own tags" on public.tags;
create policy "Users can read own tags"
  on public.tags for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own tags" on public.tags;
create policy "Users can insert own tags"
  on public.tags for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own tags" on public.tags;
create policy "Users can update own tags"
  on public.tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own tags" on public.tags;
create policy "Users can delete own tags"
  on public.tags for delete
  using (auth.uid() = user_id);

-- link_tags policies: both link and tag must belong to the caller
drop policy if exists "Users can read own link_tags" on public.link_tags;
create policy "Users can read own link_tags"
  on public.link_tags for select
  using (
    exists (
      select 1 from public.links l
      where l.id = link_id and l.user_id = auth.uid()
    )
    and exists (
      select 1 from public.tags t
      where t.id = tag_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own link_tags" on public.link_tags;
create policy "Users can insert own link_tags"
  on public.link_tags for insert
  with check (
    exists (
      select 1 from public.links l
      where l.id = link_id and l.user_id = auth.uid()
    )
    and exists (
      select 1 from public.tags t
      where t.id = tag_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own link_tags" on public.link_tags;
create policy "Users can delete own link_tags"
  on public.link_tags for delete
  using (
    exists (
      select 1 from public.links l
      where l.id = link_id and l.user_id = auth.uid()
    )
    and exists (
      select 1 from public.tags t
      where t.id = tag_id and t.user_id = auth.uid()
    )
  );
