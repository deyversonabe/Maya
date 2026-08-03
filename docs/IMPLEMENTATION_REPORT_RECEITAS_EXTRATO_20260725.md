# Implementation Report - Receitas e extrato bancario

Data: 2026-07-25

## Objetivo

Criar uma area clara para cadastro de renda mensal e variavel, separando esse fluxo da tela de Orcamentos, e adicionar uma visao tipo conta bancaria com entradas, saidas e saldo atual.

## Arquivos criados

- `app/income/page.tsx`
- `modules/finance/components/income-statement-page.tsx`
- `docs/IMPLEMENTATION_REPORT_RECEITAS_EXTRATO_20260725.md`

## Arquivos modificados

- `app/page.tsx`
- `components/app/app-shell.tsx`
- `docs/CHANGELOG.md`
- `docs/FEATURES.md`
- `docs/USER_FLOW.md`

## Decisoes tomadas

- A nova rota `/income` concentra cadastro de receitas e extrato.
- Renda variavel cria um lancamento unico do tipo `income`.
- Renda mensal fixa cria lancamentos recorrentes para a quantidade de meses definida.
- O extrato calcula saldo acumulado a partir de transacoes confirmadas e contas pagas.
- Contas pendentes e atrasadas nao reduzem o saldo atual, mas entram no saldo projetado.
- Transferencias aparecem como neutras no extrato para nao inflar entradas ou saidas.
- A tela inicial recebeu um botao direto para `Receitas e extrato`.
- A navegacao principal desktop e mobile recebeu a entrada `Receitas`.

## Dependencias adicionadas

- Nenhuma.

## Possiveis impactos

- O saldo atual passa a ter uma leitura mais parecida com conta bancaria, somando receitas e subtraindo despesas/investimentos/contas pagas.
- A previsao de saldo fica mais clara ao descontar contas ainda pendentes.

## Pendencias

- Validar visualmente em celular se o botao flutuante da tela inicial nao cobre a navegacao inferior.

## Proximos passos recomendados

- Testar cadastro de salario mensal por 12 meses.
- Testar renda variavel pequena e conferir se aparece no extrato e no saldo.
- Marcar uma conta como paga e conferir se ela aparece como debito no extrato.
