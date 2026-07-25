# Implementation Report - Valores reais e foco de digitacao

Data: 2026-07-25

## Objetivo

Corrigir exibicao e leitura de valores financeiros para evitar arredondamento indevido e resolver perda de foco/cursor durante edicao de descricoes e informacoes lidas de anexos.

## Arquivos criados

- `docs/IMPLEMENTATION_REPORT_VALORES_CURSOR_20260725.md`

## Arquivos modificados

- `lib/utils.ts`
- `app/globals.css`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/bills-page.tsx`
- `modules/finance/components/budgets-page.tsx`
- `modules/finance/components/goals-page.tsx`
- `modules/finance/components/finance-dashboard.tsx`
- `modules/finance/components/financial-document-review.tsx`
- `modules/finance/lib/csv.ts`
- `modules/finance/lib/duplicates.ts`
- `modules/finance/lib/calculations.ts`
- `docs/CHANGELOG.md`

## Decisoes tomadas

- `formatCurrency` deixou de arredondar para zero casas decimais e passou a exibir centavos, preservando ate 6 casas relevantes quando existirem.
- `formatPercent` deixou de arredondar para inteiro na exibicao comum e passou a preservar ate 2 casas decimais.
- Foi criado `parseFinancialAmountInput` para padronizar a leitura de valores digitados ou importados em formato brasileiro.
- A comparacao de duplicidade deixou de arredondar valores para centavos antes de comparar.
- A `key` do editor de linhas de extrato deixou de usar `description` e `date`, evitando que o React recrie o input a cada letra.
- Campos de texto receberam `caret-color` explicito para manter cursor visivel no tema escuro.

## Dependencias adicionadas

- Nenhuma.

## Possiveis impactos

- Valores com mais de duas casas decimais podem aparecer com mais precisao em dashboards, exportacoes, relatorios e mensagens da MAYA.
- A deteccao de duplicidade fica mais fiel ao valor salvo; valores muito parecidos, mas diferentes, deixam de ser tratados como iguais apenas por arredondamento.

## Pendencias

- Validar manualmente no navegador a digitacao em despesas, contas, metas, orcamentos, revisao de anexo e linhas de extrato.

## Proximos passos recomendados

- Testar com valores `10,99`, `10,999`, `1.234,56` e `1234.56`.
- Testar a edicao de descricao de uma linha importada de extrato sem o foco sair do campo.
