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

update public.finance_workspace_states
set state = state || jsonb_build_object(
  'schemaVersion', 7,
  'salonMaterials',
  case
    when jsonb_typeof(state->'salonMaterials') = 'array' then state->'salonMaterials'
    else '[]'::jsonb
  end,
  'salonServiceRecipes',
  case
    when jsonb_typeof(state->'salonServiceRecipes') = 'array' then state->'salonServiceRecipes'
    else '[]'::jsonb
  end,
  'salonStockMovements',
  case
    when jsonb_typeof(state->'salonStockMovements') = 'array' then state->'salonStockMovements'
    else '[]'::jsonb
  end,
  'updatedAt',
  to_jsonb(now())
)
where state is not null;
