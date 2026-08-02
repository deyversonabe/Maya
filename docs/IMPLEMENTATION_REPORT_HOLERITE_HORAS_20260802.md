# Implementation Report - Holerite e Horas Trabalhadas

Data: 2026-08-02

## Arquivos criados

- `app/hours/page.tsx`
- `app/api/maya/timecard/route.ts`
- `modules/finance/components/work-hours-page.tsx`
- `supabase/migrations/20260802_holerite_hours_state_merge.sql`
- `docs/IMPLEMENTATION_REPORT_HOLERITE_HORAS_20260802.md`

## Arquivos modificados

- `components/app/app-shell.tsx`
- `modules/finance/types.ts`
- `modules/finance/data/defaults.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/use-finance-store.ts`
- `modules/finance/lib/reporting.ts`
- `modules/finance/lib/report-export.ts`
- `modules/finance/components/fiscal-tools-page.tsx`
- `docs/FEATURES.md`
- `docs/DATABASE.md`
- `docs/USER_FLOW.md`
- `docs/API.md`
- `docs/SECURITY.md`
- `docs/SUPABASE_SETUP.md`
- `docs/CHANGELOG.md`

## Decisoes arquiteturais

- O estado compartilhado evoluiu para `schemaVersion: 6`, adicionando `payrollRecords` e `workTimeEntries`.
- Holerites e horas ficam no mesmo `FinanceState` sincronizado para aparecerem em todos os aparelhos autorizados.
- Holerites e horas nao alteram saldo financeiro, receitas, despesas, contas, metas ou orcamentos.
- A aba `Horas` foi criada como area separada, com calendario mensal e resumo de saldo de horas por pessoa.
- A leitura de foto de ponto foi criada como rascunho revisavel: a IA tenta extrair data, entrada, saida, intervalo e batidas, mas o usuario precisa confirmar antes de salvar.
- A foto do registro de ponto pode ficar vinculada ao dia e usar o mesmo Storage privado dos demais anexos.
- A jornada padrao foi definida conforme pedido: segunda a sexta, 08:00 as 18:00, com 72 minutos de almoco e 528 minutos esperados por dia util.
- Finais de semana nao geram debito automatico; quando preenchidos, entram como saldo positivo.
- A aba `Horas` passou a destacar sabado e domingo como `Folga`, com carga esperada zero e sem alerta de falta.
- O calendario passou a exibir status por dia (`Completo`, `Sobrando`, `Devendo`, `Folga`, `Aguardando` ou `Sem registro`), saldo semanal, banco total acumulado por pessoa e alertas de conferencia.
- A exportacao PDF mensal foi adicionada direto na aba `Horas`, incluindo resumo, lista diaria e alertas.
- O registro de holerite foi colocado dentro da aba Fiscal, pois e dado trabalhista/fiscal de conferencia e nao uma renda automatica.
- Os calculos de FGTS, ferias e 13 salario sao estimativas de conferencia. Eles nao substituem contador, advogado, Receita Federal, Caixa, INSS ou sistema oficial do empregador.
- A migration SQL `20260802_holerite_hours_state_merge.sql` atualiza a RPC de merge online para preservar `taxDocuments`, `laborBenefits`, `payrollRecords` e `workTimeEntries` em salvamentos concorrentes.

## Dependencias adicionadas

- Nenhuma dependencia nova.

## Possiveis impactos

- Dados antigos sao migrados automaticamente para `schemaVersion: 6`.
- Ambientes sem Supabase continuam usando cache local, mas ambientes configurados salvam o novo estado na mesma base compartilhada.
- Exportacoes Excel passam a conter mais abas e podem gerar arquivos maiores quando houver muitos registros.
- Exportacoes PDF da aba `Horas` dependem das bibliotecas de PDF ja instaladas no projeto.
- Como os novos dados sao sensiveis, anexos de holerite devem usar Supabase Storage privado quando disponivel.

## Pendencias

- Aplicar `supabase/migrations/20260802_holerite_hours_state_merge.sql` no Supabase antes de validar sincronizacao em producao.
- Testar upload real de holerite com Supabase Storage em producao.
- Testar login com Deyverson e Tom e conferir se um registro de horas feito em um aparelho aparece no outro.
- Testar foto real de ponto com boa luz, verificando se a Maya identifica a data alvo e preserva os horarios exatos sem arredondar.
- Testar um mes completo com registros de segunda a sexta e finais de semana sem lancamento para confirmar que sabado/domingo permanecem como folga.
- Testar exportacao PDF mensal da aba `Horas` em desktop e celular.
- Validar com contador/profissional habilitado qualquer uso juridico, fiscal ou trabalhista dos calculos estimados.
- Futuramente, considerar tabela relacional propria para `payroll_records` e `work_time_entries` quando o produto sair do modelo JSONB compartilhado.

## Proximos passos recomendados

- Aplicar o zip no GitHub e aguardar build da Vercel.
- Fazer login como Deyverson, criar um registro de horas do mes atual e confirmar sincronizacao em outro aparelho.
- Criar um holerite de teste com base oficial e bonus por fora, anexar o documento e conferir a exportacao Excel.
- Revisar periodicamente as regras de calculo trabalhista antes de usar os dados para qualquer decisao formal.
