# Implementation Report - Admin unico e sincronizacao segura

Data: 2026-07-25

## Objetivo

Corrigir bloqueios intermitentes de login, limitar funcoes administrativas ao e-mail `deyversonsilvaf@gmail.com` e reduzir risco de perda de dados em escritas concorrentes no estado financeiro compartilhado.

## Arquivos criados

- `lib/auth/admin.ts`
- `lib/auth/use-maya-admin-access.ts`
- `supabase/migrations/20260725_admin_unique_and_safe_workspace_state.sql`
- `docs/IMPLEMENTATION_REPORT_ADMIN_UNICO_SYNC_LOCK_20260725.md`

## Arquivos modificados

- `components/app/auth-gate.tsx`
- `components/app/app-shell.tsx`
- `lib/auth/use-maya-admin-access.ts`
- `modules/finance/components/admin-page.tsx`
- `modules/finance/components/data-center-page.tsx`
- `modules/finance/lib/report-export.ts`
- `modules/finance/lib/reporting.ts`
- `modules/finance/lib/use-finance-store.ts`
- `app/api/admin/_shared.ts`
- `scripts/create-supabase-auth-users.mjs`
- `package.json`
- `package-lock.json`
- `docs/CHANGELOG.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/SUPABASE_SETUP.md`
- `docs/AUTH_USERS_SETUP.md`
- `docs/API.md`
- `docs/USER_FLOW.md`
- `docs/IMPLEMENTATION_REPORT_VARREDURA_CRITICA_20260725.md`

## Decisoes arquiteturais

- Admin unico passa a ser definido por e-mail fixo: `deyversonsilvaf@gmail.com`.
- A navegacao esconde `Dados` e `Admin` para membros comuns.
- A barra principal mantem um botao `Sair` para todos os usuarios autenticados, preservando controle de sessao mesmo sem a aba `Dados`.
- As paginas `/data` e `/admin` tambem bloqueiam acesso direto por URL para membros comuns.
- As rotas `/api/admin/*` validam o e-mail admin no backend antes de consultar ou alterar dados administrativos.
- O script administrativo cria papel `admin` somente para o e-mail oficial; demais usuarios ficam como `member`.
- O salvamento do estado compartilhado deixa de usar `upsert` direto e passa a chamar `save_finance_workspace_state_locked`.
- A RPC usa lock de linha e mescla arrays por `id`, preservando lancamentos simultaneos criados por outras sessoes.
- O merge da RPC preserva campos de anexo e `documentItems` quando a mesma entidade chega com versoes diferentes entre aparelhos.
- O merge em tempo real do cliente reenvia a mescla quando este aparelho tem alteracoes locais mais novas, evitando que um dado fique salvo apenas localmente.
- A exportacao Excel removeu a dependencia `xlsx` e tambem deixou de aplicar formato monetario generico a colunas numericas de quantidade.

## Dependencias

`sharp` foi fixado em versao corrigida (`0.35.3`) por `overrides`, removendo a copia vulneravel herdada pelo Next sem usar `npm audit fix --force`.

O `package-lock.json` foi atualizado por reinstalacao controlada, elevando resolucoes automaticas seguras.

A dependencia `xlsx` foi removida porque continuava com alertas altos sem correcao disponivel. A exportacao Excel agora gera um workbook XML `.xls` compativel com Excel diretamente no navegador.

## Possiveis impactos

- A migration `20260725_admin_unique_and_safe_workspace_state.sql` precisa ser aplicada no Supabase antes do deploy final para o salvamento online funcionar.
- Escritas diretas em `finance_workspace_states` por clientes autenticados passam a ser bloqueadas; o app deve usar a RPC segura.
- Membros comuns continuam acessando dados financeiros compartilhados, mas sem central de dados, painel admin, usuarios, backup e funcoes administrativas.
- Delecoes concorrentes ainda precisam de tombstones em etapa futura para representar remocao intencional em multiplas sessoes offline.
- A exportacao Excel muda de `.xlsx` para `.xls` em XML Spreadsheet 2003, que abre no Excel e reduz superficie de dependencia.
- Registros sem tombstone ainda nao representam delecao concorrente intencional; a mudanca atual prioriza preservacao contra perda silenciosa.

## Validacao

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- `npm audit --omit=dev`: aprovado, sem vulnerabilidades reportadas.

## Pendencias

- Aplicar a migration nova no SQL Editor do Supabase.
- Fazer redeploy na Vercel depois da migration.
- Testar Deyveron e Tom em dois aparelhos adicionando lancamentos quase ao mesmo tempo.
- Considerar migracao gradual para tabelas relacionais como fonte primaria de transacoes, contas, metas e anexos.
- Monitorar atualizacoes futuras do Next/sharp sem aplicar downgrades forcados.

## Proximos passos recomendados

- Validar `save_finance_workspace_state_locked` no Supabase com duas sessoes simultaneas.
- Implementar tombstones para delecoes sincronizadas.
- Migrar a escrita de transacoes para `finance_transactions` quando o app sair do modo JSONB operacional do MVP.
