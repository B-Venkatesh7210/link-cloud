-- Brand accent for bubble fill/border (theme-color or fallback)
alter table public.links
  add column if not exists accent_color text;

comment on column public.links.accent_color is
  'Hex brand color (#rrggbb). Null until fetched; lazy-backfilled for older links.';
