create extension if not exists pgcrypto;

create table if not exists public.finance_capture_inbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  source text not null check (source in ('app','whatsapp','ofx','open_finance')),
  source_ref text,
  sender text,
  kind text not null check (kind in ('financial_document','bank_statement','text','audio')),
  status text not null default 'pending' check (status in ('pending','confirmed','discarded','expired')),
  validation_status text not null default 'review' check (validation_status in ('ready','review','blocked')),
  validation_score integer not null default 0 check (validation_score between 0 and 100),
  title text not null,
  raw_text text,
  draft jsonb not null,
  validation jsonb not null default '{}'::jsonb,
  attachment_name text,
  attachment_mime_type text,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_capture_inbox_source_ref_unique
  on public.finance_capture_inbox(workspace_id, source, source_ref)
  where source_ref is not null;

create index if not exists finance_capture_inbox_workspace_status_created_idx
  on public.finance_capture_inbox(workspace_id, status, created_at desc);

alter table public.finance_capture_inbox enable row level security;

-- Sem politicas para authenticated de proposito.
-- O acesso ao inbox passa somente pelas rotas server-side, que validam a participacao
-- na workspace e utilizam a service role. Isso impede leitura direta de rascunhos brutos.

drop trigger if exists finance_capture_inbox_set_updated_at on public.finance_capture_inbox;
create trigger finance_capture_inbox_set_updated_at
before update on public.finance_capture_inbox
for each row
execute function public.set_shared_finance_updated_at();

create or replace function public.expire_finance_capture_inbox()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.finance_capture_inbox
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at < now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_finance_capture_inbox() from public;
