-- Produktiv Sync: einmalig im Supabase SQL-Editor ausführen.
-- Eine Tabelle für alle Datensätze; jede Person sieht nur ihre eigenen Zeilen (Row Level Security).

create table if not exists public.sync_docs (
  user_id    uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  store      text    not null,
  id         text    not null,
  data       jsonb,
  deleted    boolean not null default false,
  client_ts  bigint  not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, store, id)
);

create index if not exists sync_docs_pull_idx on public.sync_docs (user_id, updated_at);

alter table public.sync_docs enable row level security;

drop policy if exists "eigene Zeilen" on public.sync_docs;
create policy "eigene Zeilen" on public.sync_docs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.sync_docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists sync_docs_touch on public.sync_docs;
create trigger sync_docs_touch before insert or update on public.sync_docs
  for each row execute function public.sync_docs_touch();
