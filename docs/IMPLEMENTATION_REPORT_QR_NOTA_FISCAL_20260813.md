# Implementation Report - QR Code de Nota Fiscal

Data: 2026-08-13

## Objetivo

Permitir que a Maya aproveite QR Codes de nota fiscal, NFC-e e cupom fiscal para melhorar o preenchimento revisavel de despesas.

## Arquivos modificados

- `modules/finance/lib/image-upload.ts`
- `modules/finance/components/expenses-page.tsx`
- `app/api/maya/receipt/route.ts`
- `modules/ai/maya.ts`
- `modules/finance/types.ts`
- `docs/API.md`
- `docs/FEATURES.md`
- `docs/IA_GUIDELINES.md`
- `docs/DATABASE.md`
- `docs/CHANGELOG.md`

## Decisoes tecnicas

- A deteccao de QR Code foi adicionada no navegador usando `BarcodeDetector` quando disponivel.
- O fluxo continua funcionando mesmo quando o navegador nao suporta leitura nativa de QR.
- A rota `/api/maya/receipt` passou a aceitar `qrPayloads` junto da imagem.
- O backend extrai chave de acesso, tipo fiscal, CNPJ do emitente, numero, serie, URL fiscal e valor/data quando esses dados existem no QR ou na pagina publica consultada com timeout curto.
- A Maya usa o QR apenas como evidencia auxiliar e continua exigindo revisao humana antes de salvar.

## Dependencias adicionadas

Nenhuma.

## Impacto no Supabase

Nao ha nova migration obrigatoria. Os novos metadados `qrCodeContent` e `qrCodeUrl` ficam dentro de `fiscalDocument`, que ja e persistido no estado financeiro compartilhado.

## Possiveis impactos

- Em navegadores sem suporte a `BarcodeDetector`, a leitura continua pelo OCR normal da MAYA.
- Consultas a paginas fiscais publicas podem falhar por indisponibilidade da SEFAZ, bloqueio regional ou instabilidade; nesses casos, o app preserva o rascunho manual/IA.
- QR Code melhora chave fiscal e metadados, mas itens da nota ainda dependem da legibilidade da imagem ou da pagina fiscal consultada.

## Validacao

- `npm run typecheck`
- `npm run build`

## Proximos passos recomendados

- Testar com NFC-e real de mercado em celular Android e desktop.
- Adicionar fallback com biblioteca dedicada de leitura de QR caso seja necessario suportar navegadores sem `BarcodeDetector`.
- Avaliar consulta fiscal por estado caso a pagina da SEFAZ retorne HTML padronizado suficiente para itens completos.
