-- Additional indexes for personal library query patterns
create index if not exists links_user_last_opened_idx
  on public.links (user_id, last_opened_at desc nulls last);

create index if not exists links_user_created_at_idx
  on public.links (user_id, created_at desc);

create index if not exists links_user_open_count_idx
  on public.links (user_id, open_count desc);

create index if not exists link_tags_link_id_idx
  on public.link_tags (link_id);
