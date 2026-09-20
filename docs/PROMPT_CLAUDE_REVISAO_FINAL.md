# Prompt para Claude — revisão final do Maya corrigido

Você é um engenheiro sênior de software especializado em Next.js 16, React 19, TypeScript, Supabase e sistemas financeiros pessoais.

Vou fornecer o ZIP corrigido do projeto Maya. Trabalhe sobre ESTE pacote; não volte para versões anteriores e não reescreva a interface sem necessidade.

## Objetivo

Fazer uma revisão final de engenharia do projeto, executar os testes/build, corrigir apenas problemas comprovados e garantir que todas as telas usem a mesma semântica financeira.

## Leia primeiro

1. `docs/REVISAO_CORRECOES_FINANCEIRAS_2026-09-20.md`
2. Os testes em `tests/`
3. `modules/finance/lib/balance.ts`
4. `modules/finance/lib/calculations.ts`
5. `modules/finance/lib/reporting.ts`
6. `modules/finance/lib/duplicates.ts`
7. `modules/finance/lib/date-validation.ts`
8. `modules/ai/maya.ts`

Os relatórios HTML de auditoria estão em `docs/auditoria/`; use-os como evidência do problema original e confronte-os com o código atual.

## Definições que NÃO podem ser misturadas

- `periodResult`: receitas realizadas - despesas realizadas - investimentos realizados no período.
- `currentBalance`: saldo de abertura + histórico acumulado de movimentos realizados/contas pagas até a data de corte.
- `unpaidBills`: contas pendentes + vencidas do mês.
- `projectedBalance`: `currentBalance - unpaidBills`.
- “Saldo” na interface deve significar saldo acumulado/posição da conta; “resultado” deve significar fluxo do período.

Não transforme novamente `periodResult` em “saldo disponível”.

## Cenário obrigatório de reconciliação

Use um teste com:

- saldo anterior/abertura equivalente a `-1809.84`;
- receita em setembro de `2800.00`;
- contas ainda não pagas de `1134.90`.

O resultado deve ser:

- `periodResult = 2800.00`;
- `currentBalance = 990.16`;
- `unpaidBills = 1134.90`;
- `projectedBalance = -144.74`.

Dashboard, Home, Meses, Extrato, relatório administrativo e exportação PDF/Excel devem apresentar os mesmos conceitos sem divergência.

## Verificações obrigatórias

1. Execute:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

2. Corrija qualquer erro real encontrado por esses comandos sem remover funcionalidades.

3. Verifique que a Home e a página MAYA aguardam a hidratação do store e não congelam a mensagem “sem dados suficientes” antes de os dados chegarem.

4. Verifique que a saúde financeira não retorna falso positivo alto quando o saldo projetado é negativo ou quando faltam dados de despesa.

5. Verifique que a economia não aparece como 100% apenas porque ainda não houve despesa paga, quando existem contas conhecidas a pagar.

6. Verifique a validação de datas:
   - datas impossíveis como 2026-02-31 devem falhar;
   - anos muito fora do histórico devem ser bloqueados/sinalizados;
   - não apagar histórico automaticamente.

7. Verifique a duplicidade:
   - mesma chave fiscal continua sendo duplicata mesmo se OCR errar o ano;
   - valor + descrição forte podem sinalizar possível erro de ano;
   - recorrências legítimas com descrições diferentes não devem ser tratadas como duplicata;
   - conta paga x transação equivalente deve ser sinalizada para evitar dupla contabilização.

8. Verifique importação/OCR:
   - “Recebido de pagamento...” deve tender a receita/entrada;
   - supermercado deve tender a Alimentação;
   - medicamentos/farmácia devem tender a Saúde;
   - preservar categoria explícita válida quando correta.

9. Verifique parcelamentos: o alerta deve usar `installmentNumber/installmentTotal` e nunca mostrar 1/3 quando o registro atual é 2/3.

10. Verifique relatório e exportações: devem distinguir “Resultado do período”, “Saldo atual” e “Saldo após contas”.

11. Não apague ou altere silenciosamente dados reais do Supabase. Primeiro gere uma auditoria dos registros suspeitos. Se for necessário corrigir dados, apresente o plano e o SQL/ação exata antes de executar algo destrutivo.

12. Preserve o design, identidade visual, rotas, autenticação, integração Supabase e funcionalidades que não estejam relacionadas ao erro.

## Critério de conclusão

Só marque como concluído se:

- testes passarem;
- typecheck passar;
- build passar;
- não houver divergência semântica de saldo entre telas;
- o cenário de R$ 2.800 / R$ 990,16 / -R$ 144,74 estiver reconciliado;
- não houver erro de hidratação da MAYA;
- nenhuma correção destrutiva de dados tiver sido executada sem revisão.

Ao final, entregue:

1. lista dos arquivos alterados;
2. problemas adicionais encontrados;
3. correções realizadas;
4. saída resumida de `npm test`, `npm run typecheck` e `npm run build`;
5. itens que ainda dependem de limpeza manual dos dados no Supabase;
6. confirmação explícita de que Dashboard, Home, Meses, Extrato e relatórios usam a mesma fonte de verdade financeira.
