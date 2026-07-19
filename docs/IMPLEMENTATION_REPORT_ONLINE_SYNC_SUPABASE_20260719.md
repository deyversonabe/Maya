# Implementation Report - Sincronizacao online com Supabase

## Arquivos criados

- `modules/finance/components/cloud-account-panel.tsx`
- `supabase/migrations/20260719_finance_states.sql`
- `docs/SUPABASE_SETUP.md`
- `docs/IMPLEMENTATION_REPORT_ONLINE_SYNC_SUPABASE_20260719.md`

## Arquivos modificados

- `modules/finance/lib/use-finance-store.ts`
- `modules/finance/components/data-center-page.tsx`
- `app/api/system/status/route.ts`
- `.env.example`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/FEATURES.md`
- `docs/USER_FLOW.md`
- `docs/API.md`
- `docs/README.md`
- `docs/CHANGELOG.md`

## Decisoes arquiteturais

- A sincronizacao online foi implementada em cima do store financeiro atual para preservar compatibilidade com o MVP e evitar reescrita grande.
- Supabase Auth foi escolhido como camada inicial de identidade por ja existir dependencia `@supabase/supabase-js` no projeto.
- A tabela `finance_states` salva o `FinanceState` versionado em JSONB, com RLS por `user_id`.
- O app continua funcionando offline/local quando Supabase nao estiver configurado ou quando o usuario nao estiver logado.
- Ao entrar na conta, dados locais existentes sao combinados com dados online por `id` para reduzir risco de perda do que ja foi cadastrado no celular.
- Alteracoes confirmadas sao enviadas para a nuvem com debounce para reduzir escritas repetidas.
- `attachmentDataUrl` nao e enviado para a nuvem nesta etapa para evitar payloads grandes; anexos devem migrar para Supabase Storage privado futuramente.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- O bundle das paginas que usam o store financeiro aumentou por carregar o cliente Supabase.
- Dados financeiros passam a poder ser acessados em mais de um aparelho quando o usuario entra com a mesma conta.
- Caso o SQL nao seja executado no Supabase, a interface informa que a sincronizacao precisa ser ativada no banco.
- Delecoes concorrentes offline ainda nao possuem tombstones; esse controle deve entrar em etapa futura se o uso multiaparelho crescer.

## Pendencias

- Criar/configurar o projeto Supabase real.
- Executar `supabase/migrations/20260719_finance_states.sql`.
- Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` na Vercel.
- Fazer redeploy.
- Testar login no celular e no desktop com o mesmo e-mail.
- Implementar Supabase Storage privado para anexos originais.

## Proximos passos recomendados

- Subir o ZIP atualizado no GitHub.
- Fazer deploy na Vercel.
- Configurar Supabase seguindo `docs/SUPABASE_SETUP.md`.
- Abrir `Dados` no celular, criar/entrar na conta e sincronizar.
- Abrir o desktop com o mesmo e-mail e conferir se a despesa aparece.
