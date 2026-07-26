create table if not exists public.finance_workspaces (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_workspace_members (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.finance_workspace_states (
  workspace_id uuid primary key references public.finance_workspaces(id) on delete cascade,
  state jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.finance_workspaces (id, name)
values ('00000000-0000-4000-8000-000000000001', 'MAYA')
on conflict (id) do nothing;

insert into public.finance_workspace_states (workspace_id, state)
values (
  '00000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'schemaVersion', 3,
    'profile', jsonb_build_object(
      'familyName', 'MAYA',
      'people', jsonb_build_array('Deyveron', 'Tom')
    ),
    'transactions', jsonb_build_array(),
    'goals', jsonb_build_array(),
    'budgets', jsonb_build_array(),
    'bills', jsonb_build_array(),
    'activityLogs', jsonb_build_array(),
    'updatedAt', now()
  )
)
on conflict (workspace_id) do nothing;

create or replace function public.set_shared_finance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists finance_workspaces_set_updated_at on public.finance_workspaces;
create trigger finance_workspaces_set_updated_at
before update on public.finance_workspaces
for each row
execute function public.set_shared_finance_updated_at();

drop trigger if exists finance_workspace_states_set_updated_at on public.finance_workspace_states;
create trigger finance_workspace_states_set_updated_at
before update on public.finance_workspace_states
for each row
execute function public.set_shared_finance_updated_at();

create or replace function public.is_finance_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.finance_workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
  );
$$;

revoke all on function public.is_finance_workspace_member(uuid) from public;
grant execute on function public.is_finance_workspace_member(uuid) to authenticated;

alter table public.finance_workspaces enable row level security;
alter table public.finance_workspace_members enable row level security;
alter table public.finance_workspace_states enable row level security;

drop policy if exists "finance_workspaces_select_member" on public.finance_workspaces;
drop policy if exists "finance_workspace_members_select_member" on public.finance_workspace_members;
drop policy if exists "finance_workspace_states_select_member" on public.finance_workspace_states;
drop policy if exists "finance_workspace_states_insert_member" on public.finance_workspace_states;
drop policy if exists "finance_workspace_states_update_member" on public.finance_workspace_states;

create policy "finance_workspaces_select_member"
on public.finance_workspaces
for select
to authenticated
using (public.is_finance_workspace_member(id));

create policy "finance_workspace_members_select_member"
on public.finance_workspace_members
for select
to authenticated
using (public.is_finance_workspace_member(workspace_id));

create policy "finance_workspace_states_select_member"
on public.finance_workspace_states
for select
to authenticated
using (public.is_finance_workspace_member(workspace_id));

create policy "finance_workspace_states_insert_member"
on public.finance_workspace_states
for insert
to authenticated
with check (public.is_finance_workspace_member(workspace_id));

create policy "finance_workspace_states_update_member"
on public.finance_workspace_states
for update
to authenticated
using (public.is_finance_workspace_member(workspace_id))
with check (public.is_finance_workspace_member(workspace_id));

do $$
begin
  alter publication supabase_realtime add table public.finance_workspace_states;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
