# Implementation Report - Varredura critica

Data: 2026-07-25

## Objetivo

Fazer uma revisao critica do pacote atual da Maya, procurando riscos de login, permissao administrativa, sincronizacao concorrente, exportacao e dependencias vulneraveis.

## Arquivos modificados

- `components/app/app-shell.tsx`
- `lib/auth/use-maya-admin-access.ts`
- `modules/finance/lib/report-export.ts`
- `package.json`
- `package-lock.json`
- `supabase/migrations/20260725_admin_unique_and_safe_workspace_state.sql`
- `docs/CHANGELOG.md`
- `docs/DATABASE.md`
- `docs/IMPLEMENTATION_REPORT_ADMIN_UNICO_SYNC_LOCK_20260725.md`
- `docs/IMPLEMENTATION_REPORT_VARREDURA_CRITICA_20260725.md`

## Correcoes aplicadas

- Adicionado botao `Sair` na barra principal para usuarios comuns, ja que a aba `Dados` passou a ser exclusiva do administrador.
- Corrigida a planilha `.xls` para nao formatar todo numero como moeda, evitando que colunas de quantidade fiquem distorcidas no Excel.
- Reforcado o merge SQL da RPC `save_finance_workspace_state_locked` para preservar anexos e `documentItems` quando duas sessoes salvam versoes diferentes do mesmo registro.
- Reforcado o merge em tempo real do cliente para reenviar mesclas locais mais novas e preservar nomes de anexo, comprovante e itens extraidos.
- Corrigido o alerta alto de seguranca herdado em `sharp`, fixando a versao `0.35.3` por `overrides` e removendo a copia vulneravel herdada do Next.

## Validacao executada

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- `npm audit --omit=dev`: aprovado, sem vulnerabilidades reportadas.
- `npm ls xlsx`: confirma que `xlsx` nao esta instalado.

## Decisoes

- Nao foi usado `npm audit fix --force`; o alerta foi resolvido por `overrides`, evitando downgrade do Next.
- A exportacao Excel permanece disponivel em `.xls` compativel com Excel, sem depender de `xlsx`.

## Pendencias conscientes

- Monitorar atualizacoes futuras de Next/sharp e manter auditoria limpa.
- Implementar tombstones futuramente para representar delecoes sincronizadas de forma perfeita entre sessoes concorrentes.
