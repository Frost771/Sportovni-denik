-- Spusť v SQL Editoru STEJNÉHO Supabase projektu jako Sportovní deník.
-- Nedotýká se stávajících tabulek deníku.
create table if not exists public.matchday_checklist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.matchday_checklist enable row level security;
revoke all on public.matchday_checklist from anon;
grant select, insert, update, delete on public.matchday_checklist to authenticated;
drop policy if exists "matchday_select_own" on public.matchday_checklist;
drop policy if exists "matchday_insert_own" on public.matchday_checklist;
drop policy if exists "matchday_update_own" on public.matchday_checklist;
drop policy if exists "matchday_delete_own" on public.matchday_checklist;
create policy "matchday_select_own" on public.matchday_checklist for select to authenticated using ((select auth.uid()) = user_id);
create policy "matchday_insert_own" on public.matchday_checklist for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "matchday_update_own" on public.matchday_checklist for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "matchday_delete_own" on public.matchday_checklist for delete to authenticated using ((select auth.uid()) = user_id);
