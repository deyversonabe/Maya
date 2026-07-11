# Deployment

Este documento explica como publicar o Juntos no GitHub e Vercel sem quebrar a estrutura do projeto.

## Estrutura correta na raiz

Na raiz do repositorio GitHub devem aparecer estes itens no mesmo nivel:

```text
.env.example
.gitignore
.vercelignore
app/
components/
docs/
lib/
modules/
next-env.d.ts
next.config.mjs
package-lock.json
package.json
postcss.config.js
prisma/
public/
tailwind.config.ts
tsconfig.json
```

## Erro comum

Nao envie a pasta do projeto para dentro de outra pasta do GitHub, como:

```text
components/ui/app/
components/ui/components/
components/ui/modules/
```

Se isso acontecer, a Vercel nao encontra os arquivos nos caminhos esperados e o build pode falhar com `npm run build exited with 1`.

## Como subir pelo GitHub web

1. Extraia o ZIP limpo em uma pasta local.
2. Abra a pasta extraida.
3. Selecione o conteudo de dentro dela, nao a pasta por fora.
4. No GitHub, va para a raiz do repositorio.
5. Use Add file > Upload files.
6. Arraste todos os itens selecionados para a raiz.
7. Confirme que `package.json` aparece na raiz.
8. Confirme que `components/app/app-shell.tsx` existe.
9. Confirme que `components/ui/button.tsx` existe.
10. Confirme que `public/brand/juntos-maya-logo.png` existe.

## Variaveis na Vercel

Para ativar a MAYA com OpenAI:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` opcional
- `OPENAI_VISION_MODEL` opcional

Para ativar Supabase/PostgreSQL no futuro:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`

## Build esperado

Com a estrutura correta, o comando de build deve ser:

```bash
npm run build
```

No projeto local, este build foi validado antes da entrega.
