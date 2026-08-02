# Implementation Report - Conciliacao de nota com despesa existente

Data: 2026-08-02

## Arquivos criados

- `docs/IMPLEMENTATION_REPORT_CONCILIACAO_NOTA_EXISTENTE_20260802.md`

## Arquivos modificados

- `modules/finance/components/expenses-page.tsx`
- `docs/CHANGELOG.md`
- `docs/FEATURES.md`
- `docs/DATABASE.md`
- `docs/USER_FLOW.md`

## Decisoes arquiteturais tomadas

- Uma nota de despesa com a mesma data e o mesmo valor de uma despesa existente nao cria novo lancamento financeiro.
- O sistema atualiza a `Transaction` existente com anexo, itens lidos, dados fiscais e observacao de conciliacao.
- O valor (`amount`) e a data (`date`) do lancamento existente sao preservados para evitar inflar o saldo ou distorcer o mes.
- A conciliacao automatica de anexo e restrita a match exato por data e valor para reduzir risco de anexar nota ao registro errado.
- Casos de valor parecido, data proxima ou tipo diferente continuam passando pelo fluxo de revisao de duplicidade.

## Dependencias adicionadas

- Nenhuma dependencia nova.

## Possiveis impactos

- Ao anexar uma nota de uma despesa ja cadastrada, a tela exibira feedback de nota anexada sem gerar novo valor.
- A despesa existente passa a exibir itens guardados da nota/extrato e o link do anexo quando disponivel.
- Descricoes muito genericas podem ser enriquecidas pela descricao lida da nota, sem alterar valores financeiros.

## Pendencias

- Evoluir para uma tela de conciliacao por item com nivel de confianca e aprovacao manual quando houver mais de um candidato.
- Migrar anexos para Storage privado como fonte principal quando a base deixar de depender do JSONB compartilhado.
- Avaliar integracao futura com Open Finance para captura bancaria automatica real.

## Proximos passos recomendados

- Testar cadastrando uma despesa manual e depois anexando a nota com a mesma data e valor.
- Confirmar que o saldo nao muda e que os itens aparecem em `Itens guardados da nota/extrato`.
- Repetir o teste em celular e desktop com usuarios diferentes para confirmar sincronizacao online.
