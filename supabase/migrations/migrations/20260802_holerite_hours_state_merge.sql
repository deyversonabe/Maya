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
      'schemaVersion', 6,
      'accounts', public.merge_finance_jsonb_array_by_id(current_state->'accounts', incoming_state->'accounts'),
      'transactions', public.merge_finance_jsonb_array_by_id(current_state->'transactions', incoming_state->'transactions'),
      'goals', public.merge_finance_jsonb_array_by_id(current_state->'goals', incoming_state->'goals'),
      'budgets', public.merge_finance_jsonb_array_by_id(current_state->'budgets', incoming_state->'budgets'),
      'bills', public.merge_finance_jsonb_array_by_id(current_state->'bills', incoming_state->'bills'),
      'taxDocuments', public.merge_finance_jsonb_array_by_id(current_state->'taxDocuments', incoming_state->'taxDocuments'),
      'laborBenefits', public.merge_finance_jsonb_array_by_id(current_state->'laborBenefits', incoming_state->'laborBenefits'),
      'payrollRecords', public.merge_finance_jsonb_array_by_id(current_state->'payrollRecords', incoming_state->'payrollRecords'),
      'workTimeEntries', public.merge_finance_jsonb_array_by_id(current_state->'workTimeEntries', incoming_state->'workTimeEntries'),
      'activityLogs', public.merge_finance_jsonb_array_by_id(current_state->'activityLogs', incoming_state->'activityLogs'),
      'updatedAt', to_jsonb(now())
    )
  from normalized;
$$;

update public.finance_workspace_states
set state =
  state ||
  jsonb_build_object(
    'schemaVersion', 6,
    'taxDocuments',
    case
      when jsonb_typeof(state->'taxDocuments') = 'array' then state->'taxDocuments'
      else '[]'::jsonb
    end,
    'laborBenefits',
    case
      when jsonb_typeof(state->'laborBenefits') = 'array' then state->'laborBenefits'
      else '[]'::jsonb
    end,
    'payrollRecords',
    case
      when jsonb_typeof(state->'payrollRecords') = 'array' then state->'payrollRecords'
      else '[]'::jsonb
    end,
    'workTimeEntries',
    case
      when jsonb_typeof(state->'workTimeEntries') = 'array' then state->'workTimeEntries'
      else '[]'::jsonb
    end,
    'updatedAt', to_jsonb(now())
  )
where state is not null;
