# MAYA Elevada

Plataforma financeira em **Next.js 16 + React 19 + TypeScript + Supabase + OpenAI API**, organizada para captura multimodal, revisao humana e automacao opcional.

> **Regra de produto:** IA pode ler, sugerir e organizar. Dinheiro so entra no sistema depois de revisao humana explicita. Tudo continua editavel depois.

A implementacao deste repositorio segue o guia em [`docs/reference/Guia-Implantacao-Maya-Elevada-2026-09-20.pdf`](docs/reference/Guia-Implantacao-Maya-Elevada-2026-09-20.pdf).

## Experiencia principal

Na Home, o usuario encontra quatro caminhos claros:

1. **Ler documento** — nota, recibo, boleto, foto, print ou PDF.
2. **Revisar capturas** — caixa unica para rascunhos vindos de IA/WhatsApp.
3. **Trazer do banco** — OFX sem conexao permanente ou Open Finance opcional.
4. **Conversar com a MAYA** — analise financeira contextual.

## O que esta implementado

- leitura de foto/print/PDF e rascunho editavel;
- leitura de extrato em imagem/PDF com linhas editaveis e reconciliacao;
- validacao `Pronto / Revisar / Bloqueado`;
- Caixa de Capturas em `/captures`;
- WhatsApp: texto, audio, imagem e documento/PDF -> rascunho;
- transcricao de audio via modelo configuravel;
- OFX com previa e preservacao de `FITID` para idempotencia;
- Open Finance opcional via Pluggy com Connect Token server-side;
- contas, transacoes e investimentos em modo leitura antes de importar;
- menu principal reduzido e funcoes secundarias em `Mais`;
- motor financeiro com semantica separada de resultado do periodo, saldo atual e saldo apos contas;
- GitHub Actions, Dependabot e auditoria estatica de producao.

## Estrutura relevante

```text
.github/
  workflows/ci.yml
  ISSUE_TEMPLATE/
app/
  captures/
  banking/
  api/
    captures/
    maya/
    whatsapp/webhook/
    open-finance/
modules/
  captures/
  finance/
  ai/
  whatsapp/
  open-finance/
supabase/migrations/
  20260920_finance_capture_inbox.sql
  20260920_open_finance_items.sql
docs/
  ARQUITETURA_MAYA_ELEVADA.md
  GO_LIVE_MAYA_ELEVADA.md
  PROMPT_CLAUDE_REVISAO_MAYA_ELEVADA.md
  reference/Guia-Implantacao-Maya-Elevada-2026-09-20.pdf
```

## Configuracao

Copie `.env.example` para `.env.local` e preencha apenas os provedores que vai usar. OFX funciona sem Pluggy; WhatsApp e Open Finance podem permanecer desligados.

Nunca exponha no navegador:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `WHATSAPP_APP_SECRET`
- `PLUGGY_CLIENT_SECRET`
- `PLUGGY_WEBHOOK_SECRET`

## Banco

Aplique todas as migrations existentes e, obrigatoriamente, as migrations da Caixa de Capturas e Open Finance.

A inbox usa retencao inicial de 14 dias para rascunhos. Defina tambem uma politica de retencao para anexos do Storage antes de abrir o produto para clientes.

## Validacao local e CI

```bash
npm ci
npm test
npm run typecheck
npm run audit:production
npm run build
```

O workflow `.github/workflows/ci.yml` executa os mesmos gates em push/PR para `main`.

## Open Finance

A integracao e opcional. O backend gera Connect Token com `PLUGGY_CLIENT_ID` + `PLUGGY_CLIENT_SECRET`; essas credenciais nunca chegam ao browser. A tela `/banking` permite:

- conectar/atualizar uma instituicao;
- visualizar contas/cartoes;
- visualizar investimentos;
- revisar movimentacoes;
- confirmar somente as novas, ignorando duplicidades ja identificadas.

Para producao, configure o webhook do provedor com o header `X-Maya-Pluggy-Secret` correspondente a `PLUGGY_WEBHOOK_SECRET`.

## WhatsApp

A rota e `/api/whatsapp/webhook`. Com `WHATSAPP_ENABLED=false`, o webhook nao processa mensagens. Antes de ativar, teste challenge, assinatura `x-hub-signature-256`, texto, audio, imagem e PDF.

Toda captura recebida pelo WhatsApp deve aparecer em `/captures`; nao deve alterar saldo antes de confirmacao humana.

## Documentacao

- [Arquitetura](docs/ARQUITETURA_MAYA_ELEVADA.md)
- [Go-live](docs/GO_LIVE_MAYA_ELEVADA.md)
- [Prompt para Claude](docs/PROMPT_CLAUDE_REVISAO_MAYA_ELEVADA.md)
- [Guia-base](docs/reference/Guia-Implantacao-Maya-Elevada-2026-09-20.pdf)
