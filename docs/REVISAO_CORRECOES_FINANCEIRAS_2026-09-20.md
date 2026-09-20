# Maya — Revisão e correções financeiras (20/09/2026)

Este pacote foi reconstruído a partir do `Maya-main.zip` original e corrige os problemas apontados nos relatórios de integração de valores e varredura do código.

## Regra financeira adotada

O sistema agora separa explicitamente conceitos que antes apareciam misturados:

- **Resultado do período**: receitas realizadas - despesas realizadas - investimentos realizados.
- **Saldo atual**: saldo de abertura + histórico acumulado de movimentações realizadas e contas pagas até a data de corte.
- **Contas não pagas**: contas pendentes + vencidas do mês analisado.
- **Saldo após contas / saldo projetado**: saldo atual - contas ainda não pagas do mês.
- **Economia projetada**: calcula a economia considerando despesas realizadas e contas conhecidas ainda não pagas; se não houver informação suficiente de saída, retorna dados insuficientes em vez de 100% artificial.

O módulo central é `modules/finance/lib/balance.ts`.

## Principais correções

1. Fonte única para saldo acumulado e projeção financeira.
2. Dashboard e Home usam saldo atual acumulado em vez de resultado mensal.
3. Aba Meses diferencia resultado do período, saldo acumulado e saldo após contas.
4. Relatórios/PDF/Excel usam as mesmas definições do motor financeiro central.
5. Score de saúde financeira considera liquidez atual/projetada e confiança dos dados; não premia mês vazio como economia perfeita.
6. Home e página MAYA aguardam hidratação do store antes de fixar a mensagem inicial.
7. Validação de datas verifica calendário real e faixa histórica plausível.
8. Registros antigos suspeitos são sinalizados; não são apagados automaticamente.
9. Detecção de duplicidade foi ampliada para erro provável de ano usando valor + identidade textual.
10. Conciliação conta paga x transação é sinalizada quando há risco de dupla contabilização.
11. Importação de extrato reconhece descrições fortes de entrada, como “recebido”, antes de aceitar um tipo incorreto vindo do OCR/IA.
12. Categorização automática de extrato foi reforçada para Alimentação, Saúde, Combustível, Transporte, Moradia, Tecnologia, Beleza e Viagem.
13. Alertas de parcelamento usam `installmentNumber/installmentTotal`, evitando textos 1/3 x 2/3 incoerentes.
14. Tendência do Dashboard passa a carregar também o saldo acumulado de fechamento do período.

## Arquivos centrais alterados

- `modules/finance/lib/balance.ts` (novo)
- `modules/finance/lib/date-validation.ts` (novo)
- `modules/finance/lib/calculations.ts`
- `modules/finance/lib/duplicates.ts`
- `modules/finance/lib/reporting.ts`
- `modules/finance/lib/report-export.ts`
- `modules/finance/types.ts`
- `modules/ai/maya.ts`
- `modules/finance/components/finance-dashboard.tsx`
- `modules/finance/components/home-screen.tsx`
- `modules/finance/components/maya-page.tsx`
- `modules/finance/components/months-page.tsx`
- `modules/finance/components/income-statement-page.tsx`
- `modules/finance/components/bills-page.tsx`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/admin-page.tsx`

## Testes adicionados

- `tests/balance-reconciliation.test.ts`
- `tests/date-validation.test.ts`
- `tests/duplicates.test.ts` ampliado

## Cenário de reconciliação verificado diretamente

Com saldo anterior de `-R$ 1.809,84`, receita de `R$ 2.800,00` e contas não pagas de `R$ 1.134,90`, o motor corrigido retorna:

- Resultado do período: `R$ 2.800,00`
- Saldo atual: `R$ 990,16`
- Contas não pagas: `R$ 1.134,90`
- Saldo projetado: `-R$ 144,74`
- Economia projetada: `59,47%` no cenário de teste, em vez de `100%`
- Score local no cenário de teste: `54/100`, sem o falso positivo de `95/100`

Também foi verificado que um registro `2022-07-15` é marcado como historicamente suspeito quando a conta começa em 2026, e que o caso “Conta de água e esgoto” x “Água”, mesmo valor R$ 118,47 com diferença grande de ano, é sinalizado como possível duplicata.

## Validação executada neste ambiente

- Type-check isolado dos módulos financeiros centrais: **OK**.
- Transpilação/sintaxe de 119 arquivos `.ts/.tsx`: **OK**.
- Teste de execução direta do motor de saldo/projeção: **OK**.
- Teste de execução direta do relatório financeiro: **OK**.
- Teste de alerta de data suspeita e duplicidade: **OK**.

### Limitação do ambiente

A instalação completa de dependências (`npm ci`) ficou bloqueada/pendurada neste ambiente, portanto não foi possível concluir aqui os comandos oficiais `npm test`, `npm run typecheck` e `npm run build` com todas as dependências do Next.js instaladas.

No ambiente local/Claude/Vercel, execute obrigatoriamente:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Só considerar a revisão encerrada quando os quatro comandos terminarem sem erro.

## Dados existentes no Supabase

O código **não apaga automaticamente** registros suspeitos de 2022/2023, duplicatas ou categorias históricas incorretas. Isso é intencional: exclusão automática pode apagar dados legítimos.

Após validar o build, revisar manualmente no banco/aplicação:

- registros com anos 2022/2023 fora do histórico real;
- possível duplicidade da conta de água de R$ 118,47;
- lançamento “Recebido de pagamento...” classificado como despesa;
- registros históricos em “Outros” que deveriam ser Alimentação/Saúde/etc.;
- vínculos entre conta paga e transação que representam o mesmo pagamento.

Faça backup antes de qualquer correção destrutiva no banco.
