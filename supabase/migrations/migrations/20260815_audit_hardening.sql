alter table public.finance_workspace_states
  add column if not exists version integer not null default 0;

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
      'taxDocuments', public.merge_finance_jsonb_array_by_id(current_state->'taxDocuments', incoming_state->'taxDocuments'),
      'laborBenefits', public.merge_finance_jsonb_array_by_id(current_state->'laborBenefits', incoming_state->'laborBenefits'),
      'payrollRecords', public.merge_finance_jsonb_array_by_id(current_state->'payrollRecords', incoming_state->'payrollRecords'),
      'workTimeEntries', public.merge_finance_jsonb_array_by_id(current_state->'workTimeEntries', incoming_state->'workTimeEntries'),
      'salonMaterials', public.merge_finance_jsonb_array_by_id(current_state->'salonMaterials', incoming_state->'salonMaterials'),
      'salonServiceRecipes', public.merge_finance_jsonb_array_by_id(current_state->'salonServiceRecipes', incoming_state->'salonServiceRecipes'),
      'salonStockMovements', public.merge_finance_jsonb_array_by_id(current_state->'salonStockMovements', incoming_state->'salonStockMovements'),
      'activityLogs', public.merge_finance_jsonb_array_by_id(current_state->'activityLogs', incoming_state->'activityLogs'),
      'deletedEntityIds', (
        select coalesce(jsonb_agg(distinct item), '[]'::jsonb)
        from jsonb_array_elements(
          coalesce(current_state->'deletedEntityIds', '[]'::jsonb) ||
          coalesce(incoming_state->'deletedEntityIds', '[]'::jsonb)
        ) as ids(item)
      ),
      'updatedAt', to_jsonb(now())
    )
  from normalized;
$$;

create or replace function public.save_finance_workspace_state_locked(
  p_workspace_id uuid,
  p_state jsonb,
  p_expected_version integer default null
)
returns table(state jsonb, updated_at timestamptz, version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state jsonb;
  current_version integer;
  next_state jsonb;
  saved_state jsonb;
  saved_updated_at timestamptz;
  saved_version integer;
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

  select workspace_state.state, workspace_state.version
  into current_state, current_version
  from public.finance_workspace_states workspace_state
  where workspace_state.workspace_id = p_workspace_id
  for update;

  if not found then
    next_state := p_state || jsonb_build_object('updatedAt', to_jsonb(now()));

    insert into public.finance_workspace_states (workspace_id, state, updated_by, version)
    values (p_workspace_id, next_state, auth.uid(), 1)
    returning finance_workspace_states.state, finance_workspace_states.updated_at, finance_workspace_states.version
    into saved_state, saved_updated_at, saved_version;
  else
    if p_expected_version is not null and p_expected_version <> current_version then
      raise exception 'finance state version conflict' using errcode = '40001';
    end if;

    next_state := public.merge_finance_workspace_state(current_state, p_state);

    update public.finance_workspace_states
    set state = next_state,
        updated_by = auth.uid(),
        version = finance_workspace_states.version + 1
    where workspace_id = p_workspace_id
    returning finance_workspace_states.state, finance_workspace_states.updated_at, finance_workspace_states.version
    into saved_state, saved_updated_at, saved_version;
  end if;

  return query select saved_state, saved_updated_at, saved_version;
end;
$$;

revoke all on function public.save_finance_workspace_state_locked(uuid, jsonb, integer) from public;
grant execute on function public.save_finance_workspace_state_locked(uuid, jsonb, integer) to authenticated;
