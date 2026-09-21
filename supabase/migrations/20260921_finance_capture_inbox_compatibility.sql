-- MAYA Elevada — compatibilidade/hardening da Caixa de Capturas
-- Torna compatível a migration inicial já aplicada com o contrato usado pelo código atual.
-- Idempotente e sem remoção de dados.

alter table if exists public.finance_capture_inbox
  add column if not exists source_ref text,
  add column if not exists sender text,
  add column if not exists kind text,
  add column if not exists validation_status text not null default 'review',
  add column if not exists validation_score integer not null default 0,
  add column if not exists title text,
  add column if not exists raw_text text,
  add column if not exists draft jsonb not null default '{}'::jsonb,
  add column if not exists validation jsonb not null default '{}'::jsonb,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null;

-- Compatibilidade com a primeira versão da tabela, que usava raw_content/parsed.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_capture_inbox'
      and column_name = 'raw_content'
  ) then
    execute 'update public.finance_capture_inbox set raw_text = coalesce(raw_text, raw_content) where raw_text is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_capture_inbox'
      and column_name = 'parsed'
  ) then
    execute 'update public.finance_capture_inbox set draft = case when draft = ''{}''::jsonb and parsed is not null then parsed else draft end';
  end if;
end $$;

update public.finance_capture_inbox
set kind = coalesce(kind, 'text')
where kind is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_capture_inbox'
      and column_name = 'suggested_description'
  ) then
    execute $sql$
      update public.finance_capture_inbox
      set title = coalesce(nullif(title, ''), nullif(suggested_description, ''), 'Captura')
      where title is null or title = ''
    $sql$;
  else
    update public.finance_capture_inbox
    set title = 'Captura'
    where title is null or title = '';
  end if;
end $$;

alter table public.finance_capture_inbox
  alter column kind set not null,
  alter column title set not null;

-- A migration inicial combinava NOT NULL com ON DELETE SET NULL em created_by.
-- Isso impediria exclusão futura de usuário. Se a coluna existir, permita NULL.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_capture_inbox'
      and column_name = 'created_by'
  ) then
    alter table public.finance_capture_inbox alter column created_by drop not null;
  end if;
end $$;

create unique index if not exists finance_capture_inbox_source_ref_unique
  on public.finance_capture_inbox(workspace_id, source, source_ref)
  where source_ref is not null;

create index if not exists finance_capture_inbox_workspace_status_created_idx
  on public.finance_capture_inbox(workspace_id, status, created_at desc);

-- Mantém RLS ativo. O acesso aos rascunhos permanece server-side via service role.
alter table public.finance_capture_inbox enable row level security;
