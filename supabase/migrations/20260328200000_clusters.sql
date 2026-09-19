-- Clusters: nested folders of links with optional AI placement
create table if not exists public.clusters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.clusters (id) on delete cascade,
  name text,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  is_ai boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clusters_user_id_idx on public.clusters (user_id);
create index if not exists clusters_user_parent_idx on public.clusters (user_id, parent_id);

drop trigger if exists clusters_set_updated_at on public.clusters;
create trigger clusters_set_updated_at
  before update on public.clusters
  for each row execute function public.set_updated_at();

alter table public.links
  add column if not exists cluster_id uuid references public.clusters (id) on delete set null;

alter table public.links
  add column if not exists cluster_x double precision;

alter table public.links
  add column if not exists cluster_y double precision;

alter table public.links
  add column if not exists cluster_placement text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'links_cluster_placement_check'
  ) then
    alter table public.links
      add constraint links_cluster_placement_check
      check (cluster_placement is null or cluster_placement in ('ai', 'user'));
  end if;
end $$;

create index if not exists links_cluster_id_idx on public.links (cluster_id);

alter table public.clusters enable row level security;

drop policy if exists "Users can read own clusters" on public.clusters;
create policy "Users can read own clusters"
  on public.clusters for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own clusters" on public.clusters;
create policy "Users can insert own clusters"
  on public.clusters for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own clusters" on public.clusters;
create policy "Users can update own clusters"
  on public.clusters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own clusters" on public.clusters;
create policy "Users can delete own clusters"
  on public.clusters for delete
  using (auth.uid() = user_id);
