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
      'schemaVersion', 4,
      'accounts', public.merge_finance_jsonb_array_by_id(current_state->'accounts', incoming_state->'accounts'),
      'transactions', public.merge_finance_jsonb_array_by_id(current_state->'transactions', incoming_state->'transactions'),
      'goals', public.merge_finance_jsonb_array_by_id(current_state->'goals', incoming_state->'goals'),
      'budgets', public.merge_finance_jsonb_array_by_id(current_state->'budgets', incoming_state->'budgets'),
      'bills', public.merge_finance_jsonb_array_by_id(current_state->'bills', incoming_state->'bills'),
      'activityLogs', public.merge_finance_jsonb_array_by_id(current_state->'activityLogs', incoming_state->'activityLogs'),
      'updatedAt', to_jsonb(now())
    )
  from normalized;
$$;

update public.finance_workspace_states
set state =
  state ||
  jsonb_build_object(
    'schemaVersion', 4,
    'accounts',
    case
      when jsonb_typeof(state->'accounts') = 'array' and jsonb_array_length(state->'accounts') > 0 then state->'accounts'
      else jsonb_build_array(
        jsonb_build_object(
          'id', 'account_main',
          'name', 'Carteira do casal',
          'kind', 'checking',
          'owner', 'Casal',
          'openingBalance', 0,
          'openingBalanceDate', to_char(current_date, 'YYYY-MM-DD'),
          'color', '#55f7ff',
          'createdAt', now()
        )
      )
    end,
    'updatedAt', to_jsonb(now())
  )
where state is not null;
