# Implementation Report - Nota PDF e Visibilidade em Despesas

## Arquivos modificados

- `app/api/maya/receipt/route.ts`
- `modules/ai/maya.ts`
- `modules/finance/lib/image-upload.ts`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/financial-document-review.tsx`
- `docs/CHANGELOG.md`

## Decisoes arquiteturais

- `Anexar nota` passou a aceitar imagem e PDF sem criar rota nova.
- PDFs sao preservados como PDF no Storage privado e enviados ao backend como `fileDataUrl` apenas para extracao de texto.
- A rota `/api/maya/receipt` usa `pdf-parse`, dependencia ja existente no projeto, para extrair texto de PDF antes de chamar a MAYA.
- A MAYA agora aceita imagem, texto extraido de PDF ou ambos no mesmo fluxo de rascunho revisavel.
- A nota continua sem gerar transacao automatica ate o usuario revisar e confirmar o salvamento.
- A listagem de despesas ganhou selos de `Nota anexada`, `Fiscal` e quantidade de itens para deixar evidente quando o anexo esta associado ao lancamento.

## Dependencias adicionadas

- Nenhuma.

## Possiveis impactos

- PDF escaneado sem texto interno pode exigir envio como imagem ou foto, pois `pdf-parse` extrai texto digital, nao OCR de paginas rasterizadas.
- PDFs acima do limite da rota sao recusados para evitar estouro de payload em serverless.
- Se o Supabase Storage nao estiver configurado, o anexo pode ficar apenas no estado local/base64 ate o salvamento em nuvem ser corrigido.

## Pendencias

- Testar com PDF real de NFC-e/DANFE e com PDF escaneado.
- Avaliar conversao de PDF escaneado para imagem no futuro, se houver muita nota nesse formato.
- Avaliar uma fila fiscal assistida para importar dados obtidos manualmente no portal Nota Fiscal Paulista, sem armazenar senha do usuario.

## Proximos passos recomendados

- Subir o ZIP atualizado no GitHub.
- Redeploy na Vercel.
- Testar `Despesas > Anexar nota` com PDF e imagem.
- Confirmar que o rascunho aparece, que `Confirmar despesa` soma no mes da data da nota e que `Ver anexo` abre o PDF/imagem.
