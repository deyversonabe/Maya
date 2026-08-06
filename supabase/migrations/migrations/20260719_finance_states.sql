create table if not exists public.finance_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_states enable row level security;

create or replace function public.set_finance_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists finance_states_set_updated_at on public.finance_states;

create trigger finance_states_set_updated_at
before update on public.finance_states
for each row
execute function public.set_finance_states_updated_at();

drop policy if exists "finance_states_select_own" on public.finance_states;
drop policy if exists "finance_states_insert_own" on public.finance_states;
drop policy if exists "finance_states_update_own" on public.finance_states;
drop policy if exists "finance_states_delete_own" on public.finance_states;

create policy "finance_states_select_own"
on public.finance_states
for select
to authenticated
using (auth.uid() = user_id);

create policy "finance_states_insert_own"
on public.finance_states
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "finance_states_update_own"
on public.finance_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "finance_states_delete_own"
on public.finance_states
for delete
to authenticated
using (auth.uid() = user_id);
