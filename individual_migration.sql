-- Run in Supabase SQL Editor before deploying the UI.
begin;
alter table public.sport_entries add column if not exists is_individual boolean not null default false;
update public.sport_entries set is_individual = false where is_individual is null;
alter table public.sport_entries alter column is_individual set default false;
alter table public.sport_entries alter column is_individual set not null;
comment on column public.sport_entries.is_individual is 'Volitelný rozlišovací štítek Individuál, bez cíle nebo povinnosti.';
commit;
