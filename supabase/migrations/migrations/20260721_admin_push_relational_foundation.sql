create extension if not exists pgcrypto;

alter table public.finance_workspace_members
  add column if not exists display_name text,
  add column if not exists recovery_email text,
  add column if not exists status text not null default 'active',
  add column if not exists last_seen_at timestamptz,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_by uuid references auth.users(id) on delete set null;

do $$
begin
  alter table public.finance_workspace_members
    add constraint finance_workspace_members_status_check check (status in ('active', 'blocked'));
exception
  when duplicate_object then null;
end;
$$;

update public.finance_workspace_members
set status = 'active'
where status is null;

create table if not exists public.finance_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.finance_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  subscription_id uuid not null references public.finance_push_subscriptions(id) on delete cascade,
  alert_key text not null,
  delivered_on date not null default current_date,
  delivered_at timestamptz not null default now(),
  unique (subscription_id, alert_key, delivered_on)
);

create table if not exists public.finance_transactions (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  id text not null,
  type text not null,
  description text not null,
  amount numeric(14,2) not null,
  category text not null,
  person text not null,
  transaction_date date not null,
  payment_method text,
  payment_recipient text,
  source text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.finance_bills (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  id text not null,
  title text not null,
  amount numeric(14,2) not null,
  category text not null,
  person text not null,
  due_date date not null,
  status text not null,
  payment_method text,
  payment_recipient text,
  payment_code text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.finance_goals (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null,
  due_date date not null,
  priority text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.finance_attachments (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  id uuid primary key default gen_random_uuid(),
  owner_entity text not null,
  owner_id text not null,
  storage_path text not null,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

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
      and member.status = 'active'
  );
$$;

revoke all on function public.is_finance_workspace_member(uuid) from public;
grant execute on function public.is_finance_workspace_member(uuid) to authenticated;

alter table public.finance_push_subscriptions enable row level security;
alter table public.finance_push_deliveries enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_bills enable row level security;
alter table public.finance_goals enable row level security;
alter table public.finance_attachments enable row level security;

drop policy if exists "finance_workspace_members_update_self_last_seen" on public.finance_workspace_members;

create or replace function public.touch_finance_workspace_member(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.finance_workspace_members
  set last_seen_at = now()
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
    and status = 'active';
end;
$$;

revoke all on function public.touch_finance_workspace_member(uuid) from public;
grant execute on function public.touch_finance_workspace_member(uuid) to authenticated;

drop policy if exists "finance_push_subscriptions_select_member" on public.finance_push_subscriptions;
drop policy if exists "finance_push_subscriptions_insert_self" on public.finance_push_subscriptions;
drop policy if exists "finance_push_subscriptions_update_self" on public.finance_push_subscriptions;
drop policy if exists "finance_push_subscriptions_delete_self" on public.finance_push_subscriptions;

create policy "finance_push_subscriptions_select_member"
on public.finance_push_subscriptions
for select
to authenticated
using (public.is_finance_workspace_member(workspace_id));

create policy "finance_push_subscriptions_insert_self"
on public.finance_push_subscriptions
for insert
to authenticated
with check (public.is_finance_workspace_member(workspace_id) and user_id = auth.uid());

create policy "finance_push_subscriptions_update_self"
on public.finance_push_subscriptions
for update
to authenticated
using (public.is_finance_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_finance_workspace_member(workspace_id) and user_id = auth.uid());

create policy "finance_push_subscriptions_delete_self"
on public.finance_push_subscriptions
for delete
to authenticated
using (public.is_finance_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "finance_transactions_member_all" on public.finance_transactions;
drop policy if exists "finance_bills_member_all" on public.finance_bills;
drop policy if exists "finance_goals_member_all" on public.finance_goals;
drop policy if exists "finance_attachments_member_all" on public.finance_attachments;

create policy "finance_transactions_member_all"
on public.finance_transactions
for all
to authenticated
using (public.is_finance_workspace_member(workspace_id))
with check (public.is_finance_workspace_member(workspace_id));

create policy "finance_bills_member_all"
on public.finance_bills
for all
to authenticated
using (public.is_finance_workspace_member(workspace_id))
with check (public.is_finance_workspace_member(workspace_id));

create policy "finance_goals_member_all"
on public.finance_goals
for all
to authenticated
using (public.is_finance_workspace_member(workspace_id))
with check (public.is_finance_workspace_member(workspace_id));

create policy "finance_attachments_member_all"
on public.finance_attachments
for all
to authenticated
using (public.is_finance_workspace_member(workspace_id))
with check (public.is_finance_workspace_member(workspace_id));

drop trigger if exists finance_push_subscriptions_set_updated_at on public.finance_push_subscriptions;
create trigger finance_push_subscriptions_set_updated_at
before update on public.finance_push_subscriptions
for each row
execute function public.set_shared_finance_updated_at();
