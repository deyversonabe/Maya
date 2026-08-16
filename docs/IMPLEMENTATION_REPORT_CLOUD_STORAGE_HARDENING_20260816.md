# Implementation Report - Cloud Storage Hardening - 2026-08-16

## Resumo

Foi feita uma varredura critica no modo de armazenamento e sincronizacao da Maya, com foco em evitar perda futura de dados, sobrescrita entre aparelhos e retorno de itens ja excluidos.

## Arquivos criados

- `supabase/migrations/20260816_cloud_storage_hardening.sql`
- `docs/IMPLEMENTATION_REPORT_CLOUD_STORAGE_HARDENING_20260816.md`

## Arquivos modificados

- `modules/finance/types.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/state-merge.ts`
- `modules/finance/lib/use-finance-store.ts`
- `tests/state-merge.test.ts`
- `docs/CHANGELOG.md`
- `docs/DATABASE.md`
- `docs/SUPABASE_SETUP.md`
- `supabase/verificacao-pos-deploy.sql`

## Decisoes arquiteturais

- Mantida a fonte operacional atual em `finance_workspace_states.state` como JSONB compartilhado, porque a aplicacao ainda esta estruturada ao redor desse estado unico.
- Reforcado o caminho correto de escrita via RPC `save_finance_workspace_state_locked`, com bloqueio de linha no Postgres, versao otimista e retry no cliente quando houver conflito.
- O merge por item agora usa `updatedAt`/`createdAt` para impedir que uma versao antiga de outro aparelho sobrescreva uma versao mais nova do mesmo registro.
- `deletedEntityIds` foi mantido como tombstone de exclusao sincronizada e ampliado no cliente para ate 5000 IDs, reduzindo o risco de dados apagados voltarem quando um aparelho antigo sincronizar.
- A migration nova recria a RPC de merge preservando anexos, itens lidos de documentos e dados fiscais, ao mesmo tempo em que remove dos arrays qualquer entidade marcada como excluida.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- E necessario executar `supabase/migrations/20260816_cloud_storage_hardening.sql` no Supabase depois de subir o ZIP para o GitHub.
- Apos a migration, salvamentos concorrentes devem manter ambos os lancamentos quando forem IDs diferentes e preservar a versao mais recente quando for o mesmo ID.
- Itens excluidos devem continuar bloqueados contra reaparecimento em merges futuros.

## Pendencias

- Validar em producao com dois usuarios/aparelhos reais: criar, editar e excluir uma transacao em cada dispositivo e confirmar que a base compartilhada permanece igual apos atualizar a pagina.
- Evolucao futura recomendada: migrar gradualmente de JSONB unico para tabelas relacionais (`finance_transactions`, `bills`, `goals`, `attachments`, `audit_logs`) para escala SaaS maior.

## Proximos passos recomendados

- Subir o ZIP atualizado no GitHub.
- Executar a migration `20260816_cloud_storage_hardening.sql` no SQL Editor do Supabase.
- Rodar `supabase/verificacao-pos-deploy.sql`.
- Fazer redeploy na Vercel.
- Testar login e sincronizacao com Deyverson e Tom em dispositivos diferentes.
