select
  workspace_id,
  version,
  state->>'schemaVersion' as schema_version,
  jsonb_typeof(state->'transactions') as transactions_type,
  jsonb_typeof(state->'bills') as bills_type,
  jsonb_typeof(state->'taxDocuments') as tax_documents_type,
  jsonb_typeof(state->'laborBenefits') as labor_benefits_type,
  jsonb_typeof(state->'payrollRecords') as payroll_records_type,
  jsonb_typeof(state->'workTimeEntries') as work_time_entries_type,
  jsonb_typeof(state->'salonMaterials') as salon_materials_type,
  jsonb_typeof(state->'salonServiceRecipes') as salon_recipes_type,
  jsonb_typeof(state->'salonStockMovements') as salon_stock_type,
  jsonb_typeof(state->'deletedEntityIds') as deleted_entity_ids_type,
  updated_at
from public.finance_workspace_states;

select
  id,
  name,
  public,
  file_size_limit
from storage.buckets
where id = 'maya-finance-attachments';

select
  lower(auth_user.email) as email,
  member.role,
  member.status
from public.finance_workspace_members member
join auth.users auth_user on auth_user.id = member.user_id
order by member.role, email;

select
  proname,
  pg_get_function_arguments(oid) as arguments
from pg_proc
where proname in ('merge_finance_workspace_state', 'save_finance_workspace_state_locked')
order by proname, arguments;

select
  proname,
  pg_get_function_arguments(oid) as arguments
from pg_proc
where proname in (
  'merge_finance_jsonb_item_preserving_attachment',
  'merge_finance_jsonb_array_by_id',
  'merge_finance_deleted_entity_ids',
  'remove_finance_jsonb_array_deleted_ids'
)
order by proname, arguments;
