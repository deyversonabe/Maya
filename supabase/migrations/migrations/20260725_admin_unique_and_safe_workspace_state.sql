create or replace function public.enforce_single_maya_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  select lower(coalesce(email, ''))
  into target_email
  from auth.users
  where id = new.user_id;

  if new.role = 'admin' and target_email <> 'deyversonsilvaf@gmail.com' then
    new.role = 'member';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_workspace_members_enforce_single_maya_admin on public.finance_workspace_members;
create trigger finance_workspace_members_enforce_single_maya_admin
before insert or update of user_id, role on public.finance_workspace_members
for each row
execute function public.enforce_single_maya_admin();

update public.finance_workspace_members member
set role = case
  when lower(coalesce(auth_user.email, '')) = 'deyversonsilvaf@gmail.com' then 'admin'
  else 'member'
end
from auth.users auth_user
where member.user_id = auth_user.id;

create or replace function public.merge_finance_jsonb_item_preserving_attachment(p_existing jsonb, p_incoming jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when p_existing is null then p_incoming
    when p_incoming is null then p_existing
    else jsonb_strip_nulls(
      p_existing ||
      p_incoming ||
      jsonb_build_object(
        'attachmentDataUrl', coalesce(p_incoming->'attachmentDataUrl', p_existing->'attachmentDataUrl'),
        'attachmentStoragePath', coalesce(p_incoming->'attachmentStoragePath', p_existing->'attachmentStoragePath'),
        'attachmentMimeType', coalesce(p_incoming->'attachmentMimeType', p_existing->'attachmentMimeType'),
        'attachmentSize', coalesce(p_incoming->'attachmentSize', p_existing->'attachmentSize'),
        'attachmentImageName', coalesce(p_incoming->'attachmentImageName', p_existing->'attachmentImageName'),
        'receiptImageName', coalesce(p_incoming->'receiptImageName', p_existing->'receiptImageName'),
        'documentItems', coalesce(p_incoming->'documentItems', p_existing->'documentItems'),
        'fiscalDocument', coalesce(p_incoming->'fiscalDocument', p_existing->'fiscalDocument')
      )
    )
  end;
$$;

create or replace function public.merge_finance_jsonb_array_by_id(p_existing jsonb, p_incoming jsonb)
returns jsonb
language sql
immutable
as $$
  with existing_items as (
    select
      value,
      value->>'id' as item_id,
      0 as source_order,
      ordinality::integer as item_order
    from jsonb_array_elements(
      case when jsonb_typeof(p_existing) = 'array' then p_existing else '[]'::jsonb end
    ) with ordinality
  ),
  incoming_items as (
    select
      value,
      value->>'id' as item_id,
      1 as source_order,
      ordinality::integer as item_order
    from jsonb_array_elements(
      case when jsonb_typeof(p_incoming) = 'array' then p_incoming else '[]'::jsonb end
    ) with ordinality
  ),
  all_items as (
    select
      value,
      source_order,
      item_order,
      case
        when item_id is null or item_id = '' then concat('__no_id_', source_order, '_', item_order)
        else item_id
      end as merge_key
    from existing_items
    union all
    select
      value,
      source_order,
      item_order,
      case
        when item_id is null or item_id = '' then concat('__no_id_', source_order, '_', item_order)
        else item_id
      end as merge_key
    from incoming_items
  ),
  grouped_items as (
    select
      merge_key,
      min(source_order) as first_source_order,
      min(item_order) as first_item_order,
      (array_agg(value order by item_order desc) filter (where source_order = 0))[1] as existing_value,
      (array_agg(value order by item_order desc) filter (where source_order = 1))[1] as incoming_value
    from all_items
    group by merge_key
  )
  select coalesce(
    jsonb_agg(
      public.merge_finance_jsonb_item_preserving_attachment(existing_value, incoming_value)
      order by first_source_order, first_item_order
    ),
    '[]'::jsonb
  )
  from grouped_items;
$$;

create or replace function public.merge_finance_workspace_state(p_current jsonb, p_incoming jsonb)
returns jsonb
language sql
stable
as $$
  with normalized as (
    select
      coalesce(p_current, '{}'::jsonb) as current_state,
      coalesce(p_incoming, '{}'::jsonb) as incoming_state
  )
  select
    current_state ||
    incoming_state ||
    jsonb_build_object(
      'transactions', public.merge_finance_jsonb_array_by_id(current_state->'transactions', incoming_state->'transactions'),
      'goals', public.merge_finance_jsonb_array_by_id(current_state->'goals', incoming_state->'goals'),
      'budgets', public.merge_finance_jsonb_array_by_id(current_state->'budgets', incoming_state->'budgets'),
      'bills', public.merge_finance_jsonb_array_by_id(current_state->'bills', incoming_state->'bills'),
      'activityLogs', public.merge_finance_jsonb_array_by_id(current_state->'activityLogs', incoming_state->'activityLogs'),
      'updatedAt', to_jsonb(now())
    )
  from normalized;
$$;

create or replace function public.save_finance_workspace_state_locked(p_workspace_id uuid, p_state jsonb)
returns table(state jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state jsonb;
  next_state jsonb;
  saved_state jsonb;
  saved_updated_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid finance state' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.finance_workspace_members member
    where member.workspace_id = p_workspace_id
      and member.user_id = auth.uid()
      and coalesce(member.status, 'active') = 'active'
  ) then
    raise exception 'not authorized for finance workspace' using errcode = '42501';
  end if;

  insert into public.finance_workspaces (id, name)
  values (p_workspace_id, 'MAYA')
  on conflict (id) do nothing;

  select workspace_state.state
  into current_state
  from public.finance_workspace_states workspace_state
  where workspace_state.workspace_id = p_workspace_id
  for update;

  if not found then
    next_state := p_state || jsonb_build_object('updatedAt', to_jsonb(now()));

    insert into public.finance_workspace_states (workspace_id, state, updated_by)
    values (p_workspace_id, next_state, auth.uid())
    returning finance_workspace_states.state, finance_workspace_states.updated_at
    into saved_state, saved_updated_at;
  else
    next_state := public.merge_finance_workspace_state(current_state, p_state);

    update public.finance_workspace_states
    set state = next_state,
        updated_by = auth.uid()
    where workspace_id = p_workspace_id
    returning finance_workspace_states.state, finance_workspace_states.updated_at
    into saved_state, saved_updated_at;
  end if;

  return query select saved_state, saved_updated_at;
end;
$$;

revoke all on function public.save_finance_workspace_state_locked(uuid, jsonb) from public;
grant execute on function public.save_finance_workspace_state_locked(uuid, jsonb) to authenticated;

drop policy if exists "finance_workspace_states_insert_member" on public.finance_workspace_states;
drop policy if exists "finance_workspace_states_update_member" on public.finance_workspace_states;
drop policy if exists "finance_workspace_states_insert_via_rpc" on public.finance_workspace_states;
drop policy if exists "finance_workspace_states_update_via_rpc" on public.finance_workspace_states;

create policy "finance_workspace_states_insert_via_rpc"
on public.finance_workspace_states
for insert
to authenticated
with check (false);

create policy "finance_workspace_states_update_via_rpc"
on public.finance_workspace_states
for update
to authenticated
using (false)
with check (false);
