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
      'schemaVersion', 6,
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

update public.finance_workspace_states
set state = state || jsonb_build_object(
  'deletedEntityIds',
  case
    when jsonb_typeof(state->'deletedEntityIds') = 'array' then state->'deletedEntityIds'
    else '[]'::jsonb
  end,
  'updatedAt',
  to_jsonb(now())
)
where state is not null;

update storage.buckets
set file_size_limit = 5000000
where id = 'maya-finance-attachments';
