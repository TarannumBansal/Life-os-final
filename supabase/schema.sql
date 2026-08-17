-- LifeOS private sync store. Run once in the Supabase SQL editor.
-- One row per synced record, owned by the authenticated user. No other users can read it.

create table if not exists public.lifeos_records (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  table_name  text        not null,
  id          text        not null,
  updated_at  bigint      not null,        -- ms epoch, the LWW clock
  deleted_at  bigint,                      -- tombstone (null = live)
  payload     jsonb       not null default '{}'::jsonb,
  primary key (user_id, table_name, id)
);

create index if not exists lifeos_records_updated_idx
  on public.lifeos_records (user_id, updated_at);

-- Row-Level Security: a user can only see and write their OWN rows.
alter table public.lifeos_records enable row level security;

drop policy if exists "own rows - select" on public.lifeos_records;
create policy "own rows - select" on public.lifeos_records
  for select using (auth.uid() = user_id);

drop policy if exists "own rows - modify" on public.lifeos_records;
create policy "own rows - modify" on public.lifeos_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
