create table if not exists public.finance_open_finance_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  provider text not null default 'pluggy',
  item_id text not null,
  client_user_id text,
  connector_name text,
  status text not null default 'connected',
  last_event text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, item_id)
);

create index if not exists finance_open_finance_items_workspace_idx
  on public.finance_open_finance_items(workspace_id, provider);

alter table public.finance_open_finance_items enable row level security;
drop trigger if exists finance_open_finance_items_set_updated_at on public.finance_open_finance_items;
create trigger finance_open_finance_items_set_updated_at
before update on public.finance_open_finance_items
for each row
execute function public.set_shared_finance_updated_at();


-- Sem policy para authenticated: leitura/escrita somente por rotas server-side que validam
-- a participacao na workspace e usam SUPABASE_SERVICE_ROLE_KEY.
