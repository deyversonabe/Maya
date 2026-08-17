# Deployment

Este documento explica como publicar o Maya no GitHub e Vercel sem quebrar a estrutura do projeto.

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
public/
supabase/
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
10. Confirme que `public/brand/maya-logo.png` existe.

## Variaveis na Vercel

Para ativar a MAYA com OpenAI:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` opcional
- `OPENAI_VISION_MODEL` opcional
- `OPENAI_PDF_MODEL` opcional (fallback para `OPENAI_MODEL`)

Para colocar o produto no ar sem WhatsApp:

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5-mini`
- `OPENAI_PDF_MODEL=gpt-5-mini`
- `OPENAI_VISION_MODEL=gpt-4o-mini`
- `NEXT_PUBLIC_APP_URL=https://maya-steel.vercel.app`
- `WHATSAPP_ENABLED=false`

Nesse modo, o cadastro por foto continua funcionando dentro do app em `Despesas > Anexar nota` ou `Abrir camera`. A entrada por WhatsApp fica pausada ate a Meta liberar o numero.

Se a leitura de nota cair no rascunho manual mesmo com chave configurada, conferir primeiro:

1. `OPENAI_API_KEY` existe em Production e Preview na Vercel.
2. `OPENAI_VISION_MODEL` esta preenchida com modelo que aceita imagem, recomendado `gpt-4o-mini`.
3. A chave tem credito/limite disponivel no projeto OpenAI.
4. O deploy foi refeito depois de alterar variaveis.
5. Os logs da Vercel mostram `maya_receipt_read_failed` com categoria segura da falha.

As rotas `/api/maya/receipt` e `/api/maya/timecard` declaram `maxDuration = 60` e usam timeout interno menor para a leitura de IA. PDFs usam preferencialmente upload direto para o bucket privado `maya-finance-attachments`; a Function recebe apenas uma URL assinada temporaria. O envio em base64 permanece apenas como fallback para arquivos pequenos. Isso evita depender de parser PDF nativo no serverless e reduz risco de exceder o limite de payload da Function.

Para ativar WhatsApp no futuro:

- `WHATSAPP_ENABLED=true`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_API_VERSION`

Para ativar sincronizacao online com Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MAYA_WORKSPACE_ID`
- `NEXT_PUBLIC_MAYA_SESSION_IDLE_MINUTES`
- `DATABASE_URL`

## Sincronizacao online com Supabase

Para salvar dados online e acessar do celular e desktop:

1. Crie um projeto no Supabase.
2. Em Authentication, mantenha login por e-mail/senha ativo.
3. Abra SQL Editor.
4. Execute as migrations de `supabase/migrations/` no SQL Editor do Supabase, na ordem do nome do arquivo.
5. Confirme que `20260802_holerite_hours_state_merge.sql`, `20260802_online_deletion_tombstones.sql` e `20260803_salon_materials_state_merge.sql` foram aplicadas para preservar holerites, horas, exclusoes sincronizadas e dados do salao na sincronizacao online.
6. Na Vercel, configure:

```text
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_publica
NEXT_PUBLIC_MAYA_WORKSPACE_ID=00000000-0000-4000-8000-000000000001
NEXT_PUBLIC_MAYA_SESSION_IDLE_MINUTES=15
```

7. Faca redeploy.
8. Crie usuarios e membros seguindo `docs/AUTH_USERS_SETUP.md`.
9. No app, abra `Dados` e entre na conta.
10. Usuarios autorizados passam a ver a mesma base financeira.

Observacao: os dados financeiros sincronizam online; anexos usam Supabase Storage privado quando a migration de Storage estiver aplicada. Para PDF de nota/ponto, o Storage e tambem o caminho preferencial de leitura: o navegador envia o arquivo diretamente ao bucket e a API recebe uma URL assinada de curta duracao. Se o Storage nao estiver disponivel, existe fallback local/base64 apenas dentro do limite seguro do request.

## Build esperado

Com a estrutura correta, o comando de build deve ser:

```bash
npm run build
```

O repositorio inclui `.github/workflows/quality.yml`, que executa `npm ci`, `npm run typecheck`, `npm test` e `npm run build` em cada push para `main` e em pull requests. O deploy deve ser considerado apto somente quando esse Quality Gate estiver verde.
