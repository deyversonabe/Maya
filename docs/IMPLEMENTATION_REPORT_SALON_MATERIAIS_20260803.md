# Implementation Report - Gestao de materiais do salao

Data: 2026-08-03

## Arquivos criados

- `app/salon/page.tsx`
- `modules/finance/components/salon-materials-page.tsx`
- `supabase/migrations/20260803_salon_materials_state_merge.sql`
- `docs/IMPLEMENTATION_REPORT_SALON_MATERIAIS_20260803.md`

## Arquivos modificados

- `components/app/app-shell.tsx`
- `modules/finance/types.ts`
- `modules/finance/data/defaults.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/use-finance-store.ts`
- `scripts/create-supabase-auth-users.mjs`
- `docs/FEATURES.md`
- `docs/DATABASE.md`
- `docs/USER_FLOW.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/SUPABASE_SETUP.md`
- `docs/README.md`
- `docs/DEPLOYMENT.md`

## Decisoes arquiteturais

- A gestao do salao foi adicionada ao `FinanceState` versionado como `schemaVersion: 7`, mantendo compatibilidade com a sincronizacao online atual em JSONB.
- Foram criadas tres entidades operacionais: `SalonMaterial`, `SalonServiceRecipe` e `SalonStockMovement`.
- Estoque nao gera receita, despesa ou saldo financeiro automaticamente.
- Venda de servico cria uma transacao de renda com `source: salon_sale`, usando o valor cheio recebido no extrato.
- Baixa de estoque fica registrada como movimento interno `usage`, vinculado a transacao da venda.
- Exclusao de uma venda do salao devolve ao estoque os materiais consumidos e remove os movimentos internos vinculados.
- A RPC `merge_finance_workspace_state` foi atualizada por migration para mesclar materiais, fichas e movimentos por `id`, preservando tombstones de exclusao.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- Depois do upload no GitHub, a migration `20260803_salon_materials_state_merge.sql` deve ser executada no Supabase para que a nuvem mescle corretamente os dados da aba `Salao`.
- Se a migration nao for aplicada, o app ainda migra localmente, mas a sincronizacao online pode nao preservar os novos arrays em conflitos concorrentes.
- Como estoque nao cria despesa automaticamente, compras de material continuam precisando ser lancadas em `Despesas` ou `Contas` quando o objetivo for afetar o caixa.

## Pendencias

- Testar com dados reais de materiais do studio.
- Definir categorias finais de material conforme rotina do salao.
- Avaliar relatorio futuro de margem por periodo e por servico.

## Proximos passos recomendados

- Executar a migration `supabase/migrations/20260803_salon_materials_state_merge.sql` no Supabase.
- Fazer redeploy na Vercel.
- Cadastrar 2 ou 3 materiais reais, criar uma ficha de sobrancelha e registrar uma venda teste.
- Abrir em outro aparelho com o mesmo usuario autorizado e confirmar que estoque, ficha, venda e extrato aparecem sincronizados.

## Validacao

- `npm.cmd run typecheck`: aprovado.
- `npm.cmd run build`: aprovado.
