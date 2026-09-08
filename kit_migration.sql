-- Run before deploying the match kit UI. Existing entries keep NULL colors.
begin;
alter table public.sport_entries
  add column if not exists jersey_color text,
  add column if not exists shorts_color text,
  add column if not exists socks_color text;
alter table public.sport_entries drop constraint if exists sport_entries_kit_colors;
alter table public.sport_entries add constraint sport_entries_kit_colors check (
  (jersey_color is null or jersey_color in ('black','yellow','red','blue')) and
  (shorts_color is null or shorts_color in ('black','yellow','red')) and
  (socks_color is null or socks_color in ('black','yellow','red','blue'))
);
alter table public.sport_entries drop constraint if exists sport_entries_kit_scope;
alter table public.sport_entries add constraint sport_entries_kit_scope check (
  (jersey_color is null and shorts_color is null and socks_color is null) or
  (event_type = 'Zápas' and (
    (sport = 'Fotbal' and coalesce(role, 'Brankář') = 'Brankář') or
    (sport = 'Florbal' and shorts_color is null and socks_color is null)
  ))
);
commit;
