# Implementation Report - Leitura DANFE e notas fiscais

Data: 2026-07-25

## Objetivo

Reforcar a leitura de notas e despesas pela MAYA para reconhecer documentos fiscais brasileiros, incluindo DANFE NF-e, DANFE NFC-e e cupom fiscal, mantendo revisao humana obrigatoria antes de salvar.

## Arquivos criados

- `docs/IMPLEMENTATION_REPORT_DANFE_READING_20260725.md`

## Arquivos modificados

- `modules/ai/maya.ts`
- `modules/finance/types.ts`
- `modules/finance/components/financial-document-review.tsx`
- `modules/finance/components/document-items-panel.tsx`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/bills-page.tsx`
- `modules/finance/components/finance-dashboard.tsx`
- `modules/finance/lib/use-finance-store.ts`
- `supabase/migrations/20260725_admin_unique_and_safe_workspace_state.sql`
- `docs/API.md`
- `docs/CHANGELOG.md`
- `docs/DATABASE.md`
- `docs/FEATURES.md`
- `docs/IA_GUIDELINES.md`

## Decisoes arquiteturais

- A leitura de DANFE foi implementada como extensao do rascunho financeiro existente, sem criar salvamento automatico.
- Metadados fiscais foram adicionados como campo opcional `fiscalDocument`, preservando compatibilidade com registros antigos.
- Itens de nota passaram a aceitar quantidade, unidade, valor unitario, codigo, EAN e NCM quando legiveis.
- O merge local e a RPC de merge no Supabase foram atualizados para preservar `fiscalDocument` em sincronizacoes concorrentes.

## Regras de qualidade aplicadas

- A MAYA deve usar o valor total da nota ou valor pago como valor principal.
- A MAYA nao deve usar impostos, descontos, troco, subtotal ou valor unitario como total da despesa.
- Chave de acesso so deve ser aceita quando houver 44 digitos legiveis.
- QR Code e codigo de barras nao devem ser inferidos quando nao houver texto legivel.
- Campos sem confianca continuam vazios e entram em `missingFields`.

## Dependencias adicionadas

- Nenhuma dependencia nova.

## Possiveis impactos

- Respostas de IA para notas podem ser um pouco maiores por causa dos metadados e itens fiscais.
- A leitura continua dependente de `OPENAI_API_KEY` e de um modelo com visao configurado em `OPENAI_VISION_MODEL`.

## Pendencias

- Testar com fotos reais de DANFE NF-e, DANFE NFC-e e cupom fiscal em producao.
- Se o volume de itens fiscais for muito alto, considerar salvar todos os itens em tabela relacional dedicada no Supabase.

## Proximos passos recomendados

- Validar uma DANFE real no celular e conferir se a mesma despesa aparece no desktop com anexo, itens e dados fiscais.
- Monitorar logs `maya_receipt_read_failed` na Vercel em caso de falha de leitura.
