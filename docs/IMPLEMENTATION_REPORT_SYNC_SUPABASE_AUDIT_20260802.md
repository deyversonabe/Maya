# Implementation Report - Auditoria de sincronizacao Supabase

## Arquivos criados

- `supabase/migrations/20260802_online_deletion_tombstones.sql`
- `docs/IMPLEMENTATION_REPORT_SYNC_SUPABASE_AUDIT_20260802.md`

## Arquivos modificados

- `modules/finance/types.ts`
- `modules/finance/data/defaults.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/use-finance-store.ts`
- `docs/CHANGELOG.md`
- `docs/DATABASE.md`
- `docs/SUPABASE_SETUP.md`

## Decisoes arquiteturais

- Mantida a fonte operacional atual em `finance_workspace_states.state` como JSONB compartilhado, com RPC de salvamento e lock de linha.
- Adicionado `deletedEntityIds` ao `FinanceState` para tratar exclusoes como tombstones sincronizados entre aparelhos.
- Atualizada a RPC `merge_finance_workspace_state` para unir tombstones e filtrar itens removidos durante merges concorrentes.
- Mantido `localStorage` apenas como cache/fallback local; a persistencia principal em producao continua sendo Supabase Auth + Supabase Database + Storage privado.

## Dependencias adicionadas

- Nenhuma dependencia nova.

## Possiveis impactos

- A migration nova precisa ser aplicada no Supabase para que exclusoes fiquem consistentes tambem no merge server-side.
- O bucket `maya-finance-attachments` passa a aceitar arquivos otimizados ate 5 MB.
- Estados antigos sao migrados automaticamente adicionando `deletedEntityIds: []`.

## Pendencias

- Validar em producao com dois logins reais, um no celular e outro no desktop.
- Confirmar no Supabase se Realtime esta ativo para `finance_workspace_states`.
- Confirmar upload e abertura de anexo usando o bucket privado em dispositivos diferentes.

## Verificacao

- `npm.cmd run typecheck` executado com sucesso.
- `npm.cmd run build` executado com sucesso.

## Proximos passos recomendados

- Aplicar `supabase/migrations/20260802_online_deletion_tombstones.sql` no SQL Editor do Supabase.
- Fazer redeploy na Vercel apos atualizar o GitHub.
- Testar: criar despesa no celular, ver no desktop, excluir no desktop e confirmar que ela nao volta ao recarregar.
