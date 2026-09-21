# PROMPT — CORREÇÃO FINAL E GO-LIVE DA MAYA

Você é um engenheiro sênior de software especializado em Next.js 16, React 19, TypeScript, Supabase, Vercel, OpenAI API, WhatsApp Business Platform e sistemas financeiros.

Vou fornecer o projeto completo da MAYA.

## OBJETIVO

Corrigir e validar a versão atual sem recriar o sistema do zero, sem remover funcionalidades e sem alterar a essência visual/funcional da MAYA.

A prioridade é deixar o repositório tecnicamente consistente, com CI verde e pronto para Preview na Vercel.

## REGRA CENTRAL INEGOCIÁVEL

A IA pode:
- ler;
- interpretar;
- extrair;
- classificar;
- sugerir;
- criar rascunhos.

A IA NÃO pode transformar automaticamente uma leitura em lançamento financeiro definitivo.

Fluxo obrigatório:

entrada -> IA -> validação determinística -> rascunho -> revisão humana -> confirmação -> registro financeiro.

Saldo, resultado, projeção, contas a pagar, score e demais cálculos financeiros críticos devem continuar determinísticos no código.

## ESTADO CONHECIDO DO REPOSITÓRIO

O CI real do GitHub já chegou ao seguinte estado:
- npm ci: PASS;
- npm test: PASS — 17 arquivos / 54 testes na versão anterior ao patch;
- npm run typecheck: FAIL por erros conhecidos;
- audit e build não chegaram a rodar porque o typecheck interrompeu o workflow.

Os erros conhecidos eram:
1. `modules/ai/maya.ts`: Uint8Array/BlobPart.
2. `components/ui/badge.tsx`: tone `danger` ausente.
3. `modules/captures/components/capture-inbox-page.tsx`: `statement` não é TransactionType.
4. `modules/whatsapp/processor.ts`: valores inferidos como `{}` em fileName/caption.
5. `tests/receipt-validation.test.ts`: fixture sem `source` obrigatório.
6. Diretórios auto-aninhados gerados por upload de ZIP, incluindo `app/app`, `modules/modules`, `tests/tests`, `lib/lib`, `scripts/scripts`, `public/public` e migrations aninhadas.

Esses pontos já foram corrigidos neste pacote. NÃO reverta essas correções.

## PASSO 1 — VERIFICAR ESTRUTURA

Confirme que NÃO existem:

- `app/app/`
- `modules/modules/`
- `tests/tests/`
- `lib/lib/`
- `scripts/scripts/`
- `public/public/`
- `supabase/migrations/migrations/`
- `supabase/migrations/supabase/`

Se houver qualquer cópia aninhada, compare antes de apagar. Preserve migrations únicas que não existirem na raiz.

Confirme que existem na raiz das migrations:

- `20260815_audit_hardening.sql`
- `20260816_cloud_storage_hardening.sql`
- `20260920_finance_capture_inbox.sql`
- `20260920_open_finance_items.sql`
- `20260921_finance_capture_inbox_compatibility.sql`

## PASSO 2 — CAIXA DE CAPTURAS / SUPABASE

A tabela `finance_capture_inbox` JÁ pode existir em produção por migration anterior.

NÃO drope a tabela.
NÃO perca dados.
NÃO recrie a tabela de forma destrutiva.

Primeiro faça auditoria read-only do schema real.

O código atual espera, entre outros:
- `workspace_id`
- `source`
- `source_ref`
- `sender`
- `kind`
- `status`
- `validation_status`
- `validation_score`
- `title`
- `raw_text`
- `draft`
- `validation`
- `attachment_name`
- `attachment_mime_type`
- `confirmed_by`
- `confirmed_at`
- `expires_at`
- `created_at`
- `updated_at`

Se a tabela existente for a primeira versão, aplique `20260921_finance_capture_inbox_compatibility.sql`.

Essa migration é aditiva/idempotente e existe justamente para alinhar o banco já aplicado ao contrato atual do código.

A primeira versão também podia combinar:

`created_by NOT NULL` + `ON DELETE SET NULL`.

A migration de compatibilidade remove o NOT NULL se essa coluna existir, evitando bloquear exclusão futura de usuário.

## PASSO 3 — FINANCE_PUSH_DELIVERIES

NÃO crie policy para usuário autenticado apenas para "eliminar alerta".

No desenho atual:
- RLS está habilitado;
- a tabela é escrita pelo cron server-side;
- o cron usa Supabase service role;
- clientes não precisam acessar diretamente `finance_push_deliveries`.

Confirme no código antes de qualquer alteração.

## PASSO 4 — WHATSAPP FAIL-CLOSED

Confirme que `modules/whatsapp/security.ts` rejeita webhook se `WHATSAPP_APP_SECRET` estiver ausente.

O comportamento esperado é:

```ts
if (!appSecret) {
  return false;
}
```

NUNCA retornar `true` quando o segredo estiver vazio.

Confirme testes para:
- challenge GET correto;
- token incorreto;
- assinatura HMAC válida;
- assinatura com segredo incorreto;
- corpo adulterado;
- cabeçalho ausente;
- segredo ausente.

O WhatsApp só deve ser ligado em produção quando todas estas variáveis estiverem configuradas:
- `WHATSAPP_ENABLED=true`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_API_VERSION`

## PASSO 5 — OPENAI

Preserve a separação de modelos configurável por variável:

- `OPENAI_MODEL=gpt-6-astra`
- `OPENAI_PDF_MODEL=gpt-5.6-terra`
- `OPENAI_VISION_MODEL=gpt-5.6-terra`
- `OPENAI_FAST_MODEL=gpt-5.6-luna`
- `OPENAI_TRANSCRIBE_MODEL=gpt-transcribe`

Não hardcode chave de API.

`OPENAI_API_KEY` deve existir apenas no servidor.

Se algum modelo não estiver habilitado na conta usada no deploy, reporte claramente. Não substitua silenciosamente sem registrar a alteração.

Não permita que uma resposta de IA substitua cálculo financeiro determinístico.

## PASSO 6 — .ENV.EXAMPLE

Confirme que não há segredos reais.

Elimine variáveis duplicadas.

Especialmente, Pluggy deve aparecer uma única vez:

```env
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
PLUGGY_WEBHOOK_SECRET=
NEXT_PUBLIC_PLUGGY_SANDBOX=true
```

Nunca prefixe `PLUGGY_CLIENT_SECRET`, `PLUGGY_WEBHOOK_SECRET`, `OPENAI_API_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` com `NEXT_PUBLIC_`.

## PASSO 7 — OPEN FINANCE / OFX

OFX deve continuar funcionando sem Pluggy.

Open Finance é opcional no MVP.

Se Pluggy estiver desligado, o restante da aplicação não pode quebrar.

Confirme:
- FITID impede reimportação OFX;
- rotas Open Finance validam workspace;
- credenciais Pluggy ficam server-side;
- webhook Pluggy é fail-closed quando segredo não existe.

## PASSO 8 — GATES OBRIGATÓRIOS

Execute nesta ordem:

```bash
npm ci
npm test
npm run typecheck
npm run audit:production
npm run build
```

Não considere concluído se qualquer comando falhar.

Não use:
- `@ts-ignore` para esconder erro;
- `ignoreBuildErrors`;
- `any` indiscriminado;
- remoção de testes para tornar o CI verde.

Depois, execute também:

```bash
npm audit
```

Trate o resultado separadamente. Não rode `npm audit fix --force` sem analisar breaking changes.

## PASSO 9 — ACEITE FUNCIONAL

Em Preview, valide:

1. Documento/foto/print/PDF -> rascunho -> revisão -> confirmação.
2. Nada altera saldo antes da confirmação.
3. Extrato -> linhas editáveis -> reconciliação -> confirmação.
4. OFX -> prévia -> dedup FITID -> confirmação.
5. Áudio -> transcrição -> rascunho.
6. MAYA chat -> números financeiros vindos do motor determinístico.
7. Captura descartada não cria lançamento.
8. Lançamento confirmado permanece editável.
9. Mobile e desktop.
10. WhatsApp somente se a Meta estiver configurada.

## PASSO 10 — VERCEL

Não promova direto para Production.

Fluxo:

branch de correção -> CI verde -> Vercel Preview -> aceite -> mesmo commit -> Production.

Confirme as variáveis separadamente para Preview e Production.

Nunca inclua valores secretos no relatório final.

## PASSO 11 — SEGURANÇA

Confirme:
- service role apenas no servidor;
- logs sem tokens/chaves/documentos financeiros brutos desnecessários;
- RLS ativo;
- isolamento de workspace;
- webhook WhatsApp fail-closed;
- webhook Pluggy fail-closed;
- anexos privados;
- nenhuma chave em bundle/browser.

Itens externos que devem ser reportados como pendência se não puderem ser verificados pelo código:
- MFA GitHub;
- MFA Vercel;
- MFA Supabase;
- MFA OpenAI;
- MFA Meta;
- backup/PITR;
- teste real de restauração;
- política de privacidade/LGPD.

## ENTREGA FINAL

Entregue um relatório com:

1. commit/revisão analisada;
2. arquivos alterados;
3. erros encontrados;
4. correções efetuadas;
5. resultado literal dos cinco gates;
6. número de testes executados;
7. resultado do build;
8. migrations que precisam ser aplicadas;
9. variáveis faltantes, apenas pelos nomes;
10. riscos restantes;
11. decisão final:
   - GO Preview;
   - GO Production;
   - NO-GO.

Não declare GO se test, typecheck ou build estiver vermelho.
