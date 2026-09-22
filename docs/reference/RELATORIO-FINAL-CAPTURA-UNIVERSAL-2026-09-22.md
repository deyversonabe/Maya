# Relatório final — Captura universal de documentos + correção do deploy (MAYA)

Commit: `09c9ff8` sobre `69ccdec` · Branch `main` · Entregue como `maya-fix.bundle`

---

## 1. Inputs de arquivo encontrados (auditoria completa do projeto)

| # | Local | accept | Função |
|---|-------|--------|--------|
| 1 | `expenses-page` (nota) | via componente | Nota/recibo/boleto |
| 2 | `expenses-page` (extrato) | via componente | Extrato bancário |
| 3 | `bills-page` | via componente | Conta/boleto |
| 4 | `finance-dashboard` (anexo) | via componente | Lançamento por documento |
| 5 | `finance-dashboard` (CSV) | `.csv,text/csv` | Importador CSV |
| 6 | `work-hours-page` | via componente | Ponto/holerite |
| 7 | `salon-materials-page` | via componente | Nota de material |
| 8 | `fiscal-tools-page` (×3) | via componente | Documento fiscal / trabalhista / holerite |
| 9 | `fiscal-note-import` (QR câmera) | `image/*` + capture | Ler QR Code |
| 10 | `fiscal-note-import` (QR galeria) | `image/*` | Ler QR Code de foto salva |
| 11 | `fiscal-note-import` (XML) | `.xml,text/xml,application/xml` | Importar NF-e/NFC-e |
| 12 | `banking-page` (OFX) | `.ofx,application/x-ofx,text/plain` | Importador Open Finance |

## 2. Classificação de cada input

- **Documento humano legível (foto/câmera/PDF)**: itens 1, 2, 3, 4, 6, 7, 8 → padronizados.
- **Leitura de QR Code (imagem)**: itens 9 e 10 → câmera + galeria (PDF não se aplica, o leitor nativo de QR só lê imagem).
- **Importadores estruturados (não multimodais)**: CSV (5), XML (11), OFX (12) → **mantidos como estavam**.

## 3. Inputs alterados

- Despesas (nota **e** extrato), Contas, Dashboard, Horas/Ponto → passaram a usar o seletor universal (ganharam botão de câmera separado).
- **Materiais do salão**: era só `image/*` → agora foto/câmera/**PDF** e pipeline de leitura por IA com suporte a PDF (`buildDocumentReadPayload`).
- **Ferramentas fiscais** (imposto, trabalhista, holerite): era só `image/*` → agora foto/câmera/**PDF**. Holerite normalmente é PDF, então foi o ganho mais direto.
- **Nota fiscal (QR)**: não usava mais só `capture` — ganhou o caminho "Escolher foto".

## 4. Inputs que permaneceram especializados

- **OFX** (`banking-page`) — inalterado.
- **CSV** (`finance-dashboard`) — inalterado.
- **XML** (`fiscal-note-import`) — inalterado.

Nenhum deles recebeu câmera nem `image/*`, conforme instruído.

## 5. Componente universal criado

`modules/finance/components/universal-document-picker.tsx` — `UniversalDocumentPicker`.
Responsabilidades: dois botões (**Tirar foto** / **Escolher foto ou PDF**), loading, nome/tipo/tamanho
do arquivo, mensagens de erro amigáveis e validação de tipo. Não contém regra financeira — só seleciona
o arquivo e chama `onFileSelected(file)`. Apoiado por:
- `modules/finance/lib/file-kind.ts` → `isPdfFile` (MIME **ou** extensão `.pdf`, cobrindo MIME vazio no
  mobile), `isImageFile`, `isSupportedDocumentFile`, `formatFileSize`.
- `modules/finance/lib/document-payload.ts` → `buildDocumentReadPayload` (prioriza URL assinada; base64 só como fallback).

## 6. Fluxo da câmera

Botão "Tirar foto" → `<input type="file" accept="image/*" capture="environment">` → `onFileSelected` →
otimização de imagem → `/api/maya/*` → OpenAI (`input_image`, `detail:"high"`) → rascunho editável.

## 7. Fluxo da imagem (foto salva no aparelho)

Botão "Escolher foto ou PDF" → `<input type="file" accept="image/*,application/pdf">` (sem `capture`, abre
galeria/arquivos) → mesmo pipeline da câmera quando é imagem.

## 8. Fluxo do PDF

`isPdfFile` detecta → `fileToFinanceDocumentAttachment` → **1º** tenta Storage privado e usa a URL assinada
(`fileUrl`); **2º** só se não houver Storage e o arquivo for pequeno, converte para base64 (`fileDataUrl`) →
route extrai `pdfBase64 = fileDataUrl.split(",")[1]` → `readBankStatementWithMaya`/`readReceiptWithMaya` →
OpenAI Responses `input_file` com **exatamente um** de `file_url` **ou** `file_data`.

## 9. Causa raiz do problema do Extrato PDF

A leitura em si (`/api/maya/statement` + `readBankStatementWithMaya` + `input_file`) já estava correta.
Os pontos frágeis do caminho real eram:
1. **Erro engolido**: o `catch` devolvia sempre "Não foi possível ler o extrato", sem diagnóstico — impossível saber em que etapa falhava.
2. **Fallback base64 com teto baixo (5,5 MB)**: extrato de vários meses estoura o limite quando o Storage não está configurado, e a mensagem não deixava isso claro.
3. **Validação da URL assinada exige caminho terminando em `.pdf`**: se o Storage salvasse o arquivo sem a extensão `.pdf` (MIME vazio no mobile), a URL assinada era recusada com "URL inválida".

## 10. Correção aplicada (extrato)

- **Log estruturado seguro** no route: `maya_statement_pdf_failed` com `stage`, `mimeType`, `fileSize`,
  `usingSignedUrl`, `usingBase64`, `status`, `code` — **sem** base64, sem conteúdo bancário, sem token, sem URL completa, sem API key.
- **Mensagens específicas** por causa: URL expirada/não autorizada, PDF acima do limite, PDF vazio/corrompido, serviço indisponível.
- **Preservação da extensão `.pdf`**: `fileToFinanceDocumentAttachment` usa `file.type || "application/pdf"`, e o nome gravado no Storage sempre recebe extensão `.pdf` — a URL assinada passa na validação.
- **Instrução multipágina explícita** no prompt: "leia TODAS as páginas do PDF … reúna as movimentações de todas as páginas".
- **Reconciliação determinística** (já existente, confirmada): `reconciliationDifference = closingBalance − (openingBalance + entradas − saídas)` é calculada em TypeScript, não pela IA.

## 11. Teste — PDF base64

`tests/statement-route.test.ts`: envia `fileDataUrl` PDF → verifica que o route chama a IA com `pdfBase64`
e **sem** `pdfUrl`. + `tests/pdf-ai-input.test.ts` confirma `input_file` com `file_data`.

## 12. Teste — signed URL

`tests/statement-route.test.ts`: envia `fileUrl` assinada válida → verifica `pdfUrl` e **sem** `pdfBase64`;
URL de outro host → **400**. + `tests/attachment-url.test.ts` (host/bucket/token/`.pdf`) e
`tests/pdf-ai-input.test.ts` (`file_url` sem `file_data`).

## 13. Teste — multipágina

Coberto no nível de **instrução ao modelo** (prompt multipágina) e verificável pela suíte de leitura de PDF.
O teste **E2E** de um extrato real com N páginas depende de PDF real + `OPENAI_API_KEY` em Preview — ver item 20.

## 14. Resultado do `npm test`

Todos verdes.

## 15. Número de testes

**81 testes** em **21 arquivos** (eram 62 em 18; +19 novos: `file-kind`, `document-payload`, `statement-route`).

## 16. Typecheck

`tsc --noEmit` → **exit 0** (TypeScript strict mantido, sem `any` de contorno).

## 17. audit:production

`node scripts/audit-production.mjs` → **exit 0** (1 aviso pré-existente: `PLUGGY_CLIENT_SECRET` não documentado — não relacionado a esta entrega).

## 18. Build

`npm run build` → **Compiled successfully**, 28 páginas, **exit 0**. As rotas duplicadas `/app/*` desapareceram.

## 19. Riscos restantes

- **Storage do Supabase**: se o bucket `maya-finance-attachments` não estiver configurado/policiado, o PDF cai no fallback base64 e PDFs grandes (>~5,5 MB) são recusados **com mensagem clara**. Recomendado confirmar o bucket + policies em produção.
- **`OPENAI_PDF_MODEL`**: o modelo de PDF vem de env; se ausente, usa o default do código. Confirmar a env no Vercel.
- **HEIC**: iPhone pode enviar `.heic`; a leitura por IA aceita, mas a otimização local depende do suporte do navegador.
- **E2E do extrato**: ainda não validado com PDF real em Preview (ver item 20).

## 20. GO / NO-GO para Preview

- **GO** para publicar a correção do build e a captura universal (foto/câmera/PDF em todas as telas): build, testes, typecheck e audit passaram; o fluxo do PDF está provado no nível de código.
- **NO-GO para declarar o Extrato 100% concluído** até rodar o teste E2E manual em Preview com um **extrato PDF real** e confirmar que gera um `BankStatementDraft` revisável — exatamente o critério que você definiu. Só falta esse passo, que exige o ambiente Preview com a chave da OpenAI (não reproduzível fora do deploy).
