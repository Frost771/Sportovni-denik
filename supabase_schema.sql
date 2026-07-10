-- Spusť celý soubor v Supabase → SQL Editor.
-- Tabulky používají Row Level Security: každý přihlášený uživatel vidí jen svá data.

create extension if not exists pgcrypto;

create table if not exists public.sport_seasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sport text not null check (sport in ('Fotbal', 'Florbal')),
  season text not null,
  status text not null default 'Aktivní' check (status in ('Aktivní', 'Uzavřená')),
  created_date date not null default current_date,
  closed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sport, season)
);

create table if not exists public.sport_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('Trénink', 'Zápas')),
  event_date date not null,
  sport text not null check (sport in ('Fotbal', 'Florbal')),
  season text not null,
  training_type text,
  match_type text,
  role text,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  intensity integer check (intensity is null or intensity between 1 and 10),
  opponent text,
  venue text,
  goals_for integer check (goals_for is null or goals_for >= 0),
  goals_against integer check (goals_against is null or goals_against >= 0),
  minutes_played integer check (minutes_played is null or minutes_played >= 0),
  goals_conceded integer check (goals_conceded is null or goals_conceded >= 0),
  rating integer check (rating is null or rating between 1 and 10),
  decision text,
  result text,
  points integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_active_season_per_sport
  on public.sport_seasons (user_id, sport)
  where status = 'Aktivní';

create index if not exists sport_entries_user_date
  on public.sport_entries (user_id, event_date);

create index if not exists sport_entries_user_sport_season
  on public.sport_entries (user_id, sport, season);

alter table public.sport_seasons enable row level security;
alter table public.sport_entries enable row level security;

drop policy if exists "Users read own seasons" on public.sport_seasons;
drop policy if exists "Users insert own seasons" on public.sport_seasons;
drop policy if exists "Users update own seasons" on public.sport_seasons;
drop policy if exists "Users delete own seasons" on public.sport_seasons;

create policy "Users read own seasons"
  on public.sport_seasons for select
  using ((select auth.uid()) = user_id);

create policy "Users insert own seasons"
  on public.sport_seasons for insert
  with check ((select auth.uid()) = user_id);

create policy "Users update own seasons"
  on public.sport_seasons for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own seasons"
  on public.sport_seasons for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own entries" on public.sport_entries;
drop policy if exists "Users insert own entries" on public.sport_entries;
drop policy if exists "Users update own entries" on public.sport_entries;
drop policy if exists "Users delete own entries" on public.sport_entries;

create policy "Users read own entries"
  on public.sport_entries for select
  using ((select auth.uid()) = user_id);

create policy "Users insert own entries"
  on public.sport_entries for insert
  with check ((select auth.uid()) = user_id);

create policy "Users update own entries"
  on public.sport_entries for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own entries"
  on public.sport_entries for delete
  using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sport_seasons_updated_at on public.sport_seasons;
create trigger set_sport_seasons_updated_at
before update on public.sport_seasons
for each row execute function public.set_updated_at();

drop trigger if exists set_sport_entries_updated_at on public.sport_entries;
create trigger set_sport_entries_updated_at
before update on public.sport_entries
for each row execute function public.set_updated_at();
