# WhatsApp Configuration Status

Data do registro: 2026-07-15
Atualizacao: 2026-07-18

Este documento registra o estado atual da configuracao do WhatsApp Cloud API do Maya, para permitir retomada futura sem depender do historico do chat.

## Estado atual na Meta

O app usado na Meta e `Maya`, acessado em `developers.facebook.com`.

Fluxo acessado:

```text
Conectar no WhatsApp > Etapa 2. Configuracao da producao
```

O webhook ja foi configurado corretamente e aparece com status concluido, indicado por icone verde.

Configuracao do perfil do WhatsApp Business criada:

- Nome de exibicao: `Maya`.
- Fuso horario: `(GMT-03:00) America/Sao Paulo`.
- Categoria: `Financas e bancos`.
- Motivo da categoria: foi a opcao mais proxima disponivel na lista da Meta, pois `Utilitarios e produtividade` e `Software` nao estavam disponiveis.
- Descricao: `Assistente financeira para organizar despesas, metas e planejamento do casal.`

Numero novo informado:

```text
+55 (17) 99756-4983
```

Identificadores gerados pela Meta:

```env
WHATSAPP_BUSINESS_ACCOUNT_ID=2007453506578851
WHATSAPP_PHONE_NUMBER_ID=1238924655973126
```

Observacao: `WHATSAPP_PHONE_NUMBER_ID` e o identificador tecnico usado pelo sistema. Ele e diferente do numero de telefone em si.

## Estado atual na Vercel

Projeto Vercel:

```text
maya
```

Dominio de producao:

```text
https://maya-steel.vercel.app
```

Em `Environment Variables`, todas as variaveis necessarias ja existiam previamente.

Apenas esta variavel foi atualizada:

```env
WHATSAPP_PHONE_NUMBER_ID=1238924655973126
```

O salvamento foi concluido com sucesso.

O redeploy ainda nao foi feito de proposito. A ideia e juntar esta alteracao com a atualizacao futura do `WHATSAPP_ACCESS_TOKEN`, evitando dois redeploys separados.

## Pendencia atual

A conta `Maya` na Meta esta com status:

```text
Pending review
```

Isso e uma revisao automatica interna da Meta para contas do WhatsApp Business recem-criadas.

Enquanto esse status nao mudar para liberado, o botao `Registrar` permanece bloqueado com a mensagem:

```text
Number registration and webhook subscription are unavailable for this account now
```

Efeitos do bloqueio:

- Nao e possivel verificar o numero por SMS.
- Nao e possivel verificar o numero por ligacao.
- Nao e possivel finalizar o registro do numero.
- Nao e possivel concluir a assinatura final do webhook para esse numero de producao.

Ja foi conferido em `Acoes necessarias` e nao havia pendencias manuais do lado do usuario.

Esse estado depende da propria Meta e pode levar de alguns minutos ate 24-48 horas.

## Decisao de produto em 2026-07-18

Como o status `Pending review` continuou bloqueando o registro do numero, a decisao atual e colocar o Maya no ar sem depender do WhatsApp.

O WhatsApp fica como integracao opcional e pausada. A captura de comprovantes continua disponivel pelo proprio app:

```text
Despesas > Anexar nota
Despesas > Abrir camera
```

Para producao sem WhatsApp, configurar na Vercel:

```env
WHATSAPP_ENABLED=false
NEXT_PUBLIC_APP_URL=https://maya-steel.vercel.app
```

Enquanto `WHATSAPP_ENABLED` nao for `true`, eventos recebidos pelo webhook nao serao processados como canal ativo.

## Proximos passos quando a Meta liberar

Quando o status sair de `Pending review`, retomar nesta ordem:

1. Voltar ao app `Maya` na Meta.
2. Acessar:

```text
Conectar no WhatsApp > Etapa 2. Configuracao da producao
```

3. Registrar/verificar o numero novo por SMS ou ligacao.
4. Gerar ou atualizar o token de acesso da Meta.
5. Atualizar na Vercel:

```env
WHATSAPP_ACCESS_TOKEN=novo_token_valido_da_meta
WHATSAPP_ENABLED=true
```

6. Confirmar que a Vercel continua com:

```env
WHATSAPP_PHONE_NUMBER_ID=1238924655973126
WHATSAPP_ENABLED=true
WHATSAPP_VERIFY_TOKEN=maya_webhook_seguro_2026
WHATSAPP_API_VERSION=v25.0
NEXT_PUBLIC_APP_URL=https://maya-steel.vercel.app
```

7. Fazer redeploy de producao na Vercel.
8. Validar o webhook no navegador:

```text
https://maya-steel.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=maya_webhook_seguro_2026&hub.challenge=teste123
```

Resultado esperado:

```text
teste123
```

9. Enviar uma mensagem e uma foto de nota do numero pessoal para o numero novo do Maya.
10. Confirmar se a MAYA responde com rascunho revisavel.

## Lembretes importantes

- Nao enviar tokens reais no chat.
- Se algum token aparecer em print, gerar um novo token na Meta.
- O numero novo e o numero oficial do sistema.
- O numero pessoal continua sendo usado como usuario/teste.
- Nenhuma despesa deve ser salva automaticamente sem revisao humana.
