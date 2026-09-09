begin;
alter table public.sport_entries add column if not exists opponent_difficulty integer;
alter table public.sport_entries drop constraint if exists sport_entries_opponent_difficulty_check;
alter table public.sport_entries add constraint sport_entries_opponent_difficulty_check
check (opponent_difficulty is null or (event_type = 'Zápas' and opponent_difficulty between 1 and 5));
commit;
