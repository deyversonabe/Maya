# Implementation Report - Upgrades de confiabilidade Maya - 2026-07-21

## Arquivos criados

- `modules/finance/components/attachment-link.tsx`
- `modules/finance/components/finance-notification-panel.tsx`
- `components/app/pwa-client.tsx`
- `public/sw.js`
- `supabase/migrations/20260721_finance_attachments_storage.sql`
- `docs/IMPLEMENTATION_REPORT_UPGRADES_CONFIABILIDADE_20260721.md`

## Arquivos modificados

- `app/layout.tsx`
- `app/api/system/status/route.ts`
- `modules/finance/types.ts`
- `modules/finance/data/defaults.ts`
- `modules/finance/lib/image-upload.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/use-finance-store.ts`
- `modules/finance/components/financial-document-review.tsx`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/bills-page.tsx`
- `modules/finance/components/finance-dashboard.tsx`
- `modules/finance/components/months-page.tsx`
- `modules/finance/components/data-center-page.tsx`
- `scripts/create-supabase-auth-users.mjs`
- `supabase/migrations/20260719_shared_finance_workspace.sql`
- `docs/CHANGELOG.md`
- `docs/SUPABASE_SETUP.md`
- `docs/FEATURES.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/API.md`

## Decisoes arquiteturais

- Anexos financeiros agora usam Supabase Storage privado quando o bucket `maya-finance-attachments` esta configurado.
- O app mantem fallback por `attachmentDataUrl` para nao quebrar ambientes que ainda nao aplicaram a migration de Storage.
- URLs de visualizacao de anexos sao assinadas por tempo limitado no cliente autenticado.
- Historico de atividades foi mantido dentro do `FinanceState` compartilhado para acompanhar acoes do MVP sem criar uma nova tabela relacional nesta etapa.
- Service worker cacheia apenas assets estaticos e ignora APIs financeiras, Supabase e dados dinamicos.
- Notificacoes locais dependem de permissao do navegador e funcionam como alerta complementar, nao como push server-side.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- Para usar Storage privado, e necessario aplicar `supabase/migrations/20260721_finance_attachments_storage.sql`.
- Se o bucket nao existir, o app continua salvando anexos otimizados no estado JSONB como contingencia.
- Historico de atividades aumenta o tamanho do JSONB, limitado a 200 eventos recentes.
- Notificacoes locais so aparecem em navegadores que suportam e autorizam `Notification`.

## Pendencias

- Implementar push notifications server-side se for necessario alertar com o app totalmente fechado.
- Separar entidades financeiras em tabelas relacionais antes de escalar para multi-tenant SaaS.
- Criar rotinas de retencao/exclusao de anexos antigos.

## Proximos passos recomendados

- Aplicar a migration de Storage no Supabase.
- Conferir variaveis de ambiente da Vercel.
- Fazer redeploy de producao.
- Testar upload de nota, boleto e extrato em celular e desktop.
- Confirmar que Deyverson e Tom visualizam o mesmo anexo em aparelhos diferentes.
