# Maya

Plataforma de organizacao financeira do casal: receitas, despesas, contas a pagar, metas, horas trabalhadas, aba fiscal e salao. Login por usuarios autorizados, base compartilhada no Supabase, anexos em Storage e leitura de documentos por IA.

## Stack

- Next.js 16 com App Router, React 19 e TypeScript
- Tailwind CSS
- Supabase para Auth, Postgres e Storage
- OpenAI para leitura de notas, extratos, comprovantes e cartao de ponto
- Deploy na Vercel

## Estrutura

- app - rotas do App Router e route handlers
- components - componentes de UI compartilhados
- docs - documentacao e relatorios de implementacao
- lib - clientes Supabase, autenticacao e utilitarios
- modules - dominios do sistema: finance, ai e whatsapp
- public - assets estaticos, manifest PWA e service worker
- scripts - scripts operacionais
- supabase - migrations SQL

## Variaveis de ambiente

Copie .env.example para .env.local. O arquivo .env.local nunca deve ser versionado.

Obrigatorias:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY

Notificacoes push, opcionais:

- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT

WhatsApp, mantido desligado enquanto a integracao nao esta finalizada:

- WHATSAPP_ENABLED=false

SUPABASE_SERVICE_ROLE_KEY e OPENAI_API_KEY sao chaves de servidor. Devem ficar apenas na Vercel e nunca receber o prefixo NEXT_PUBLIC.

## Desenvolvimento local

Requer Node.js 20 ou superior.

- npm install
- npm run dev

Verificacao antes de subir mudancas:

- npm run typecheck
- npm run build

## Supabase

Execute os arquivos de supabase/migrations em ordem cronologica pelo SQL Editor.

- Cadastro publico deve permanecer desativado.
- Os usuarios autorizados sao criados pelo script scripts/create-supabase-auth-users.mjs.
- O bucket maya-finance-attachments precisa existir e ser privado.
- Todos os usuarios autorizados compartilham a mesma base financeira.

## Deploy

O deploy e feito pela Vercel. Cadastre todas as variaveis acima em Settings e Environment Variables antes do primeiro build.
