-- Přidává pouze nepovinná pole; stará data ani minuty nemění.
begin;
alter table public.sport_entries add column if not exists match_role text check (match_role is null or match_role in ('Jednička', 'Dvojka', 'Trojka'));
alter table public.sport_entries add column if not exists team text;
alter table public.sport_entries add column if not exists competition text;
commit;
notify pgrst, 'reload schema';
