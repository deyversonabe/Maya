# Implementation Report - Carteiras e saldo inicial

Data: 2026-07-25

## Objetivo

Adicionar uma visao financeira mais parecida com conta bancaria, permitindo saldo inicial, carteiras internas e calculo de saldo por entrada e saida.

## Arquivos criados

- `supabase/migrations/20260725_finance_accounts_wallets.sql`
- `docs/IMPLEMENTATION_REPORT_CARTEIRAS_SALDO_INICIAL_20260725.md`

## Arquivos modificados

- `modules/finance/types.ts`
- `modules/finance/data/defaults.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/use-finance-store.ts`
- `modules/finance/components/income-statement-page.tsx`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/bills-page.tsx`
- `docs/CHANGELOG.md`
- `docs/FEATURES.md`
- `docs/USER_FLOW.md`
- `docs/DATABASE.md`
- `docs/ARCHITECTURE.md`

## Decisoes arquiteturais tomadas

- `FinanceState` evoluiu para `schemaVersion: 4`.
- `FinanceAccount` representa carteiras/contas internas com saldo inicial, data do saldo e responsavel.
- Foi criada a carteira padrao `account_main` para compatibilidade com dados antigos.
- Transacoes e contas a pagar ganharam `accountId` opcional.
- Lancamentos antigos sem `accountId` sao tratados como pertencentes a Conta principal.
- Remover uma carteira nao apaga lancamentos; eles voltam para a Conta principal.
- A nova migration atualiza a RPC de merge do Supabase para preservar `accounts` em gravacoes concorrentes.

## Dependencias adicionadas

- Nenhuma.

## Possiveis impactos

- O saldo atual em Receitas/Extrato passa a considerar saldo inicial das carteiras.
- Despesas e contas futuras podem ser vinculadas a uma carteira especifica.
- Usuarios precisam aplicar a nova migration no Supabase para a sincronizacao online mesclar carteiras corretamente.

## Pendencias

- Extratos bancarios importados ainda entram na Conta principal ate existir conciliacao por conta.
- Transferencia real entre carteiras ainda nao foi implementada; transferencias continuam neutras no extrato.

## Proximos passos recomendados

- Criar fluxo especifico de transferencia entre carteiras.
- Permitir escolher carteira durante a revisao de extrato bancario importado.
- Exibir carteira na lista mensal e nos relatatorios PDF/Excel.
