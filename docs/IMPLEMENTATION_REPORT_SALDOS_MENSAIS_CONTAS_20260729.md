# Implementation Report - Saldos mensais e contas

Data: 2026-07-29

## Arquivos criados

- `docs/IMPLEMENTATION_REPORT_SALDOS_MENSAIS_CONTAS_20260729.md`

## Arquivos modificados

- `modules/finance/lib/calculations.ts`
- `modules/finance/lib/reporting.ts`
- `modules/finance/components/months-page.tsx`
- `modules/finance/components/finance-dashboard.tsx`
- `modules/finance/components/maya-page.tsx`
- `modules/finance/components/income-statement-page.tsx`
- `docs/CHANGELOG.md`
- `docs/FEATURES.md`
- `docs/USER_FLOW.md`
- `docs/DATABASE.md`

## Decisoes arquiteturais

- Contas a pagar (`PayableBill`) passam a entrar como despesa do mes de vencimento (`dueDate`) nos calculos centrais.
- A funcao de fluxo mensal agora aceita transacoes e contas, evitando divergencia entre Dashboard, Meses, MAYA, orcamentos e relatorios.
- A pagina Meses separa despesas avulsas e contas do mes, mas usa a soma das duas como total de saidas e saldo final.
- A projecao de saldo apos contas no extrato deixa de subtrair todas as contas futuras e passa a considerar apenas contas vencidas ou do mes de referencia.

## Dependencias adicionadas

- Nenhuma dependencia adicionada.

## Possiveis impactos

- Os totais de despesas podem aumentar em meses que tenham contas cadastradas, porque agora elas sao computadas junto das saidas mensais.
- Relatorios PDF/Excel passam a refletir as contas do periodo dentro do total de despesas e do saldo.
- Orcamentos por categoria passam a considerar contas da mesma categoria no mes selecionado.

## Pendencias

- Testar com dados reais em dois aparelhos para confirmar que a sincronizacao mostra o mesmo resumo mensal.
- Avaliar, em etapa futura, migracao definitiva para tabelas relacionais por entidade para reduzir dependencia do JSONB operacional.

## Proximos passos recomendados

- Criar dados de teste com uma renda, uma despesa, uma conta pendente e uma conta recorrente em meses diferentes.
- Conferir Dashboard, Meses, Receitas/Extrato, Admin/Relatorios e MAYA usando o mesmo mes de referencia.
- Publicar novo deploy na Vercel apos atualizar o ZIP no GitHub.
