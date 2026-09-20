# MAYA Elevada — checklist para atualizar o GitHub

## Conteúdo deste pacote

Este diretório é a raiz completa do projeto. Ele inclui `.github/`, `app/`, `components/`, `docs/`, `lib/`, `modules/`, `public/`, `scripts/`, `supabase/`, `tests/`, arquivos de configuração e o guia de implantação em `docs/reference/`.

## Antes de publicar

1. Não envie `.env`, `.env.local` ou qualquer arquivo com credenciais reais.
2. Use `.env.example` apenas como referência e configure segredos no GitHub/Vercel/Supabase/Meta/OpenAI/Pluggy.
3. Execute as migrations do Supabase, em especial:
   - `20260920_finance_capture_inbox.sql`
   - `20260920_open_finance_items.sql`
4. Rode localmente:
   - `npm ci`
   - `npm test`
   - `npm run typecheck`
   - `npm run audit:production`
   - `npm run build`
5. Só faça deploy em produção se todos os gates passarem.

## Upload para GitHub

Você pode descompactar este ZIP e copiar **todo o conteúdo da pasta raiz**, incluindo arquivos/pastas ocultos como `.github`, `.gitignore` e `.env.example`, para a raiz do repositório.

Se estiver substituindo uma versão antiga, faça backup/branch antes e revise o diff antes do merge.
