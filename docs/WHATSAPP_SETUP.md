# WhatsApp Setup

Este guia descreve a integracao direta do WhatsApp Cloud API com o Juntos Maya, sem n8n.

## Objetivo

Permitir que o casal envie uma foto de nota ou comprovante pelo WhatsApp. O Juntos Maya recebe a imagem, pede leitura para a MAYA e devolve um rascunho revisavel. Nenhuma despesa deve ser salva automaticamente.

## Custo menor

Para reduzir custo:

- Usar WhatsApp Cloud API direto, sem n8n.
- Evitar provedores intermediarios enquanto o volume for baixo.
- Priorizar mensagens iniciadas pelo usuario.
- Enviar apenas respostas curtas e necessarias.
- Processar somente imagens de nota ou comprovante.
- Manter rascunho revisavel, sem automacao irreversivel.

## Variaveis de ambiente

Configure na Vercel e em `.env.local` para desenvolvimento:

```env
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_API_VERSION=v23.0
NEXT_PUBLIC_APP_URL=
```

Regras:

- `WHATSAPP_VERIFY_TOKEN`: texto secreto criado por voce para validar o webhook na Meta.
- `WHATSAPP_ACCESS_TOKEN`: token permanente ou token de sistema da Meta.
- `WHATSAPP_PHONE_NUMBER_ID`: ID do numero conectado ao WhatsApp Cloud API.
- `WHATSAPP_APP_SECRET`: segredo do app da Meta usado para validar assinatura dos webhooks.
- `WHATSAPP_API_VERSION`: versao da Graph API. Manter atualizada conforme Meta.
- `NEXT_PUBLIC_APP_URL`: URL publica do app, por exemplo `https://juntosmaya.vercel.app`.

Nunca coloque valores reais no GitHub.

## Passo a passo na Meta

1. Acesse Meta for Developers.
2. Crie ou selecione um app do tipo Business.
3. Adicione o produto WhatsApp ao app.
4. Crie ou selecione uma WhatsApp Business Account.
5. Adicione um numero de telefone para o sistema.
6. Copie o `Phone number ID`.
7. Gere um token de acesso seguro para o app.
8. Configure o webhook:
   - Callback URL: `https://SEU-DOMINIO/api/whatsapp/webhook`
   - Verify token: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
9. Assine o campo `messages` no webhook.
10. Envie uma mensagem de teste com imagem para validar o fluxo.

## Passo a passo na Vercel

1. Acesse o projeto na Vercel.
2. Abra Settings > Environment Variables.
3. Adicione todas as variaveis listadas acima.
4. Faca redeploy do projeto.
5. Na Meta, clique para verificar o webhook.
6. Envie uma foto de nota para o numero conectado.

## Fluxo implementado

1. WhatsApp chama `GET /api/whatsapp/webhook` para verificar o endpoint.
2. WhatsApp envia eventos para `POST /api/whatsapp/webhook`.
3. O sistema valida a assinatura quando `WHATSAPP_APP_SECRET` estiver configurado.
4. O sistema procura mensagens de imagem.
5. O sistema baixa a midia pela Graph API.
6. A MAYA cria um rascunho revisavel.
7. O sistema responde no WhatsApp com um resumo seguro.

## Limitacoes atuais

- O rascunho ainda nao e salvo automaticamente no banco.
- Sem login e banco em nuvem, o WhatsApp nao consegue associar a nota a um casal de forma definitiva.
- A resposta no WhatsApp orienta revisao no app.
- Para uso em producao com varios casais, implementar autenticacao, Supabase/PostgreSQL e tabela de rascunhos.

## Proxima etapa recomendada

Implementar persistencia de rascunhos recebidos por WhatsApp:

- `WhatsappContact`: telefone autorizado e casal vinculado.
- `ReceiptDraft`: rascunho pendente de revisao.
- Tela no app: "Rascunhos recebidos".

Mesmo nessa etapa, a despesa final so deve ser salva apos confirmacao humana.
