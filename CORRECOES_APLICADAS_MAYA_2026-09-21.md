# MAYA — Correções aplicadas ao pacote final

Base: MAYA Elevada + hotfix GitHub/Vercel + patch consolidado de 21/09/2026.

## Incorporado

- correções de TypeScript descritas no patch consolidado;
- `Badge` com `danger`;
- correção Blob/Uint8Array da transcrição;
- correção do tipo de transação da Caixa de Capturas;
- correção de tipos do WhatsApp;
- fixture de teste com `source` obrigatório;
- teste de assinatura/challenge do WhatsApp;
- remoção das estruturas auto-aninhadas do upload por ZIP;
- resgate de `20260815_audit_hardening.sql` e `20260816_cloud_storage_hardening.sql`;
- `.env.example` sem duplicidade de variáveis Pluggy;
- webhook Meta alterado para fail-closed quando `WHATSAPP_APP_SECRET` estiver ausente;
- teste adicional para segredo Meta ausente;
- migration `20260921_finance_capture_inbox_compatibility.sql` para alinhar, sem destruir dados, a primeira versão da Caixa de Capturas já aplicada no Supabase ao contrato do código atual.

## Banco

`finance_push_deliveries` permanece sem policy de acesso de cliente por desenho. O cron server-side utiliza service role para registrar as entregas; RLS permanece habilitado.

## Gate de validação

O relatório anterior registra que o patch consolidado passou `npm ci`, testes, typecheck, auditoria e build em ambiente com dependências completas. O GitHub atual já confirmou que a etapa de testes passou antes do typecheck.

Neste ambiente de empacotamento, `npm ci` não concluiu por timeout e removeu dependências locais; portanto os gates devem ser repetidos pelo CI/Claude após upload. O pacote inclui o prompt exato para isso.
