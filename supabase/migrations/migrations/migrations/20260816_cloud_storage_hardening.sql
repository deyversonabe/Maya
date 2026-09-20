alter table public.finance_workspace_states
  add column if not exists version integer not null default 0;

create or replace function public.merge_finance_jsonb_item_preserving_attachment(p_existing jsonb, p_incoming jsonb)
returns jsonb
language sql
immutable
as $$
  with normalized as (
    select
      p_existing as existing_value,
      p_incoming as incoming_value,
      greatest(coalesce(p_existing->>'updatedAt', ''), coalesce(p_existing->>'createdAt', '')) as existing_time,
      greatest(coalesce(p_incoming->>'updatedAt', ''), coalesce(p_incoming->>'createdAt', '')) as incoming_time
  ),
  chosen as (
    select
      case
        when existing_value is null then incoming_value
        when incoming_value is null then existing_value
        when incoming_time >= existing_time then incoming_value
        else existing_value
      end as primary_value,
      case
        when existing_value is null or incoming_value is null then null
        when incoming_time >= existing_time then existing_value
        else incoming_value
      end as secondary_value
    from normalized
  )
  select case
    when p_existing is null then p_incoming
    when p_incoming is null then p_existing
    else jsonb_strip_nulls(
      coalesce(secondary_value, '{}'::jsonb) ||
      primary_value ||
      jsonb_build_object(
        'attachmentDataUrl', coalesce(primary_value->'attachmentDataUrl', secondary_value->'attachmentDataUrl'),
        'attachmentStoragePath', coalesce(primary_value->'attachmentStoragePath', secondary_value->'attachmentStoragePath'),
        'attachmentMimeType', coalesce(primary_value->'attachmentMimeType', secondary_value->'attachmentMimeType'),
        'attachmentSize', coalesce(primary_value->'attachmentSize', secondary_value->'attachmentSize'),
        'attachmentImageName', coalesce(primary_value->'attachmentImageName', secondary_value->'attachmentImageName'),
        'receiptImageName', coalesce(primary_value->'receiptImageName', secondary_value->'receiptImageName'),
        'documentItems', coalesce(primary_value->'documentItems', secondary_value->'documentItems'),
        'fiscalDocument', coalesce(primary_value->'fiscalDocument', secondary_value->'fiscalDocument')
      )
    )
  end
  from chosen;
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

create or replace function public.merge_finance_deleted_entity_ids(p_current jsonb, p_incoming jsonb)
returns jsonb
language sql
immutable
as $$
  with ids as (
    select value as id
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_current) = 'array' then p_current else '[]'::jsonb end
    )
    union
    select value as id
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_incoming) = 'array' then p_incoming else '[]'::jsonb end
    )
  ),
  clean_ids as (
    select distinct trim(id) as id
    from ids
    where trim(id) <> ''
      and trim(id) <> 'account_main'
  )
  select coalesce(jsonb_agg(to_jsonb(id) order by id), '[]'::jsonb)
  from clean_ids;
$$;

create or replace function public.remove_finance_jsonb_array_deleted_ids(p_items jsonb, p_deleted_ids jsonb)
returns jsonb
language sql
immutable
as $$
  with deleted_ids as (
    select value as id
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_deleted_ids) = 'array' then p_deleted_ids else '[]'::jsonb end
    )
  ),
  items as (
    select value, ordinality
    from jsonb_array_elements(
      case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end
    ) with ordinality
  )
  select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
  from items
  where not exists (
    select 1
    from deleted_ids
    where deleted_ids.id = items.value->>'id'
  );
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
  ),
  deleted as (
    select public.merge_finance_deleted_entity_ids(
      current_state->'deletedEntityIds',
      incoming_state->'deletedEntityIds'
    ) as deleted_ids
    from normalized
  )
  select
    current_state ||
    incoming_state ||
    jsonb_build_object(
      'schemaVersion', 7,
      'deletedEntityIds', deleted.deleted_ids,
      'accounts', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'accounts', incoming_state->'accounts'),
        deleted.deleted_ids
      ),
      'transactions', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'transactions', incoming_state->'transactions'),
        deleted.deleted_ids
      ),
      'goals', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'goals', incoming_state->'goals'),
        deleted.deleted_ids
      ),
      'budgets', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'budgets', incoming_state->'budgets'),
        deleted.deleted_ids
      ),
      'bills', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'bills', incoming_state->'bills'),
        deleted.deleted_ids
      ),
      'salonMaterials', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'salonMaterials', incoming_state->'salonMaterials'),
        deleted.deleted_ids
      ),
      'salonServiceRecipes', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'salonServiceRecipes', incoming_state->'salonServiceRecipes'),
        deleted.deleted_ids
      ),
      'salonStockMovements', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'salonStockMovements', incoming_state->'salonStockMovements'),
        deleted.deleted_ids
      ),
      'taxDocuments', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'taxDocuments', incoming_state->'taxDocuments'),
        deleted.deleted_ids
      ),
      'laborBenefits', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'laborBenefits', incoming_state->'laborBenefits'),
        deleted.deleted_ids
      ),
      'payrollRecords', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'payrollRecords', incoming_state->'payrollRecords'),
        deleted.deleted_ids
      ),
      'workTimeEntries', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'workTimeEntries', incoming_state->'workTimeEntries'),
        deleted.deleted_ids
      ),
      'activityLogs', public.remove_finance_jsonb_array_deleted_ids(
        public.merge_finance_jsonb_array_by_id(current_state->'activityLogs', incoming_state->'activityLogs'),
        deleted.deleted_ids
      ),
      'updatedAt', to_jsonb(now())
    )
  from normalized, deleted;
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
    next_state := public.merge_finance_workspace_state('{}'::jsonb, p_state);

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

update public.finance_workspace_states
set state = public.merge_finance_workspace_state(
  state,
  jsonb_build_object(
    'schemaVersion', 7,
    'deletedEntityIds',
    case
      when jsonb_typeof(state->'deletedEntityIds') = 'array' then state->'deletedEntityIds'
      else '[]'::jsonb
    end,
    'updatedAt',
    to_jsonb(now())
  )
)
where state is not null;
