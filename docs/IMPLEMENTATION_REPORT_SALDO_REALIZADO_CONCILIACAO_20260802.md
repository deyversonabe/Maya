# Implementation Report - Saldo realizado e conciliacao bancaria inicial

Data: 2026-08-02

## Arquivos criados

- `docs/IMPLEMENTATION_REPORT_SALDO_REALIZADO_CONCILIACAO_20260802.md`

## Arquivos modificados

- `modules/finance/lib/calculations.ts`
- `modules/finance/components/months-page.tsx`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/income-statement-page.tsx`
- `docs/CHANGELOG.md`
- `docs/FEATURES.md`
- `docs/DATABASE.md`
- `docs/USER_FLOW.md`

## Decisoes arquiteturais tomadas

- Saldo realizado passa a considerar apenas transacoes com data ate hoje e contas pagas.
- Lancamentos futuros continuam visiveis, mas aparecem como previsao e nao entram no saldo realizado.
- Orcamentos passam a usar gasto realizado, sem consumir limite com recorrencias, parcelas ou contas futuras ainda nao pagas.
- Importacao de extrato passa a tentar conciliacao bancaria conservadora antes de criar novas transacoes.
- A conciliacao marca conta pendente como paga somente quando existe combinacao forte por valor, data proxima e identificacao por titulo, favorecido ou forma de pagamento.

## Dependencias adicionadas

- Nenhuma dependencia nova.

## Possiveis impactos

- O saldo atual pode ficar menor ou maior que antes porque deixou de misturar futuro com realizado.
- O saldo previsto continua disponivel para planejamento mensal.
- Ao importar extrato, algumas despesas podem deixar de virar transacao nova e passar a quitar contas pendentes automaticamente, evitando duplicidade.
- A conciliacao e propositalmente conservadora; casos sem identificacao suficiente continuarao como transacao revisavel.

## Pendencias

- Testar manualmente com extrato real contendo boleto/Pix ja cadastrado em Contas.
- Evoluir conciliacao para tela propria com nivel de confianca e aprovacao por item.
- Futuramente, migrar conciliacao para tabelas relacionais `finance_transactions` e `finance_bills` como fonte operacional.
- Conexao bancaria real via Open Finance continua fora do MVP atual.

## Proximos passos recomendados

- Criar uma conta pendente, importar um extrato com o mesmo valor/data e validar se ela vira paga sem duplicar despesa.
- Testar lancamento recorrente futuro no mes atual e confirmar que aparece como `Futuro`, mas nao altera saldo realizado.
- Validar o mesmo fluxo com usuarios Deyveron e Tom para confirmar sincronizacao na nuvem.
