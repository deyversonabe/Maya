# Implementation Report - Maya metas e marca

Data: 2026-07-20

## Arquivos criados

- `public/brand/maya-logo.png`
- `public/brand/maya-favicon.png`
- `docs/IMPLEMENTATION_REPORT_MAYA_METAS_BRAND_20260720.md`

## Arquivos modificados

- `modules/finance/types.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/use-finance-store.ts`
- `modules/finance/data/defaults.ts`
- `modules/finance/components/goals-page.tsx`
- `components/app/app-shell.tsx`
- `components/app/auth-gate.tsx`
- `components/app/legal-page.tsx`
- `app/layout.tsx`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- Documentos em `docs/`
- Paginas legais em `app/privacy`, `app/terms` e `app/data-deletion`

## Decisoes arquiteturais

- A marca textual do sistema foi consolidada como Maya.
- A logo antiga com nome anterior deixou de ser referenciada e foi retirada dos assets finais.
- Metas passaram a ter `contributions`, um historico de saldos/aportes com valor, data, observacao e data de criacao.
- `currentAmount` continua existindo para calculos rapidos de progresso, mas agora cada novo saldo pode ser registrado com data.
- A chave local nova passa a ser `maya.finance.v1`, mantendo compatibilidade silenciosa com a chave local antiga para nao perder dados no navegador.
- Nao foi criada migration SQL porque o Supabase atual armazena o `FinanceState` em JSONB; o novo campo entra no estado compartilhado.

## Dependencias adicionadas

- Nenhuma dependencia nova.

## Possiveis impactos

- Metas existentes sem historico passam a receber uma entrada de "Saldo anterior importado" quando tiverem valor atual maior que zero.
- O app instalado pelo navegador passa a se identificar como Maya no manifesto.
- A experiencia de metas fica mais detalhada e pode gerar mais atualizacoes no Supabase Realtime ao adicionar aportes.

## Pendencias

- Criar uma logo definitiva da Maya sem dependencia da imagem anterior.
- Adicionar teste automatizado para migracao de metas antigas com `currentAmount`.
- Avaliar se aportes negativos devem ser permitidos em UI propria para correcao de saldo.

## Proximos passos recomendados

- Conferir no celular a tela de Metas e testar adicionar saldo com data.
- Confirmar se o avatar atual da Maya deve permanecer como logo provisoria ou se sera substituido por uma marca final.
- Fazer redeploy na Vercel depois de subir o ZIP no GitHub.
