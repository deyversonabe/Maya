# Implementation Report - Contas, alertas e leitura de anexos

Data: 2026-07-19

## Arquivos criados

- `app/bills/page.tsx`
- `modules/finance/components/bills-page.tsx`
- `docs/IMPLEMENTATION_REPORT_CONTAS_ALERTAS_20260719.md`

## Arquivos modificados

- `app/api/maya/receipt/route.ts`
- `components/app/app-shell.tsx`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/DATABASE.md`
- `docs/FEATURES.md`
- `docs/USER_FLOW.md`
- `modules/ai/maya.ts`
- `modules/finance/components/data-center-page.tsx`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/finance-dashboard.tsx`
- `modules/finance/components/home-screen.tsx`
- `modules/finance/components/months-page.tsx`
- `modules/finance/data/defaults.ts`
- `modules/finance/lib/calculations.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/use-finance-store.ts`
- `modules/finance/types.ts`

## Decisoes arquiteturais

- O schema local evoluiu para `schemaVersion = 3`, preservando transacoes, metas, orcamentos e adicionando `bills`.
- Contas a pagar foram modeladas como `PayableBill`, separadas de `Transaction`, porque uma conta pendente nao deve ser tratada como despesa paga.
- Status atrasado e calculado tambem em tempo de exibicao para evitar informacao desatualizada quando o app fica dias sem abrir.
- A leitura de imagem da MAYA foi generalizada para `FinancialDocumentDraft`, cobrindo despesa, renda e conta a pagar.
- Dados extraidos por IA continuam sendo rascunhos revisaveis. O usuario precisa confirmar antes de salvar.
- Quando a IA nao identificar titulo, valor ou data obrigatoria com confianca, a interface exige preenchimento manual.
- Anexos confirmados podem ser guardados no armazenamento local nesta etapa. Em producao com banco real, devem migrar para storage privado.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- Backups locais passam a incluir `bills`.
- Imagens anexadas podem aumentar o tamanho do backup/localStorage.
- Usuarios com dados antigos serao migrados automaticamente para `schemaVersion = 3`.
- Alertas funcionam a partir das datas cadastradas no app. Envio externo por WhatsApp segue bloqueado enquanto a Meta nao liberar o numero.

## Pendencias

- Implementar notificacoes push reais quando houver backend, autenticacao e permissao do usuario.
- Migrar anexos para storage privado quando Supabase ou outro backend for ativado.
- Retomar envio de relatorios por WhatsApp quando o numero estiver liberado na Meta.
- Implementar pagamentos ou agendamentos somente com parceiro regulado e consentimento formal.

## Proximos passos recomendados

- Subir o zip no GitHub e fazer deploy na Vercel.
- Testar cadastro manual de conta.
- Testar anexo de boleto/Pix.
- Testar leitura de comprovante de renda no Dashboard.
- Exportar backup depois dos primeiros cadastros reais.
