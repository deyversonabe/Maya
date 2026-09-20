# Go-live da MAYA elevada

## 1. Banco

Execute as migrations em ordem, inclusive:

- `20260920_finance_capture_inbox.sql`
- `20260920_open_finance_items.sql`

Confirme RLS habilitado e mantenha `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor.

## 2. OpenAI

Configure os IDs de modelo por variavel de ambiente. Os nomes presentes em `.env.example` reproduzem o guia anexado; confirme que esses IDs estao habilitados na sua conta antes do deploy.

## 3. WhatsApp

Configure Meta App, token, Phone Number ID, App Secret, Verify Token e publique `/api/whatsapp/webhook` em HTTPS. Somente ative `WHATSAPP_ENABLED=true` depois do teste de assinatura e de texto/audio/imagem/PDF chegando em `/captures`.

## 4. Open Finance opcional

Sem Pluggy, o OFX funciona normalmente. Para Pluggy, configure `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`. Para webhook com segredo, crie o webhook no provedor enviando `X-Maya-Pluggy-Secret` com o valor de `PLUGGY_WEBHOOK_SECRET`.

## 5. Gates

```bash
npm ci
npm test
npm run typecheck
npm run audit:production
npm run build
```

Nao promova para producao se qualquer gate falhar.

## 6. Aceite funcional

1. WhatsApp texto/audio/imagem/PDF cria rascunho e nao afeta saldo.
2. Documento no app mostra `Pronto/Revisar/Bloqueado` e permite editar.
3. Extrato reconcilia saldo inicial + entradas - saidas = saldo final quando esses totais existem.
4. OFX mostra previa e impede reimportacao por identificador externo.
5. Open Finance apenas le dados ate o usuario confirmar a importacao.
6. Dashboard/Home/Extrato/Meses usam a mesma semantica financeira.
7. Mobile e desktop apresentam os caminhos principais sem excesso de navegacao.
