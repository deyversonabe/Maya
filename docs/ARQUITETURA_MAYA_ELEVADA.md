# MAYA elevada — arquitetura implementada

Esta versao traduz o guia de implantacao em uma estrutura executavel e pronta para GitHub.

## Regra central

A IA pode **ler, sugerir, classificar e organizar**. Uma movimentacao financeira so entra no estado normal do sistema depois de **revisao e confirmacao explicita**. O registro confirmado continua editavel.

## Fluxo de captura

`entrada -> extracao -> validacao deterministica -> rascunho -> revisao humana -> confirmacao -> registro editavel`

Entradas suportadas:

- app: foto, print, PDF, texto e extrato;
- WhatsApp: texto, audio, imagem e PDF;
- OFX;
- Open Finance opcional via Pluggy.

## Estados

- `ready`: validacoes automaticas fecharam; ainda exige confirmacao.
- `review`: ha incerteza ou divergencia que merece conferencia.
- `blocked`: campo essencial invalido; confirmacao bloqueada ate corrigir.

## Componentes novos

- `modules/captures/*`: tipos, validacao e persistencia server-side.
- `/captures`: caixa de entrada de rascunhos.
- `modules/open-finance/*`: Pluggy server-side e tela de conexao/importacao.
- `/banking`: OFX + Open Finance em modo revisao.
- `modules/finance/lib/ofx.ts`: parser OFX com preservacao de FITID.
- `supabase/migrations/20260920_finance_capture_inbox.sql`.
- `supabase/migrations/20260920_open_finance_items.sql`.

## Semantica financeira preservada

- **Resultado do periodo**: fluxo realizado do periodo.
- **Saldo atual**: posicao acumulada real.
- **Contas nao pagas**: obrigacoes conhecidas abertas.
- **Saldo apos contas**: saldo atual menos obrigacoes ainda nao pagas.

Nunca rotular `receitas - despesas do mes` como saldo disponivel.

## Seguranca

`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `WHATSAPP_APP_SECRET`, `PLUGGY_CLIENT_SECRET` e `PLUGGY_WEBHOOK_SECRET` sao segredos server-side. Nunca usar `NEXT_PUBLIC_` nesses valores.

A inbox e as conexoes Open Finance usam RLS sem policy para `authenticated`; o acesso e mediado pelas rotas server-side que validam a participacao na workspace.
