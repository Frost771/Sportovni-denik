alter table public.sport_entries
add column if not exists surface text;

comment on column public.sport_entries.surface is
'Povrch tréninku nebo zápasu, například přírodní tráva, umělá tráva, hala, parkety nebo sportovní PVC / taraflex.';
