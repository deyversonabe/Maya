# Implementation Report - Correcao da leitura de notas

## Arquivos criados

- `modules/finance/lib/image-upload.ts`
- `docs/IMPLEMENTATION_REPORT_RECEIPT_READING_FIX_20260719.md`

## Arquivos modificados

- `modules/ai/maya.ts`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/bills-page.tsx`
- `modules/finance/components/finance-dashboard.tsx`
- `docs/IA_GUIDELINES.md`
- `docs/API.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

## Decisoes arquiteturais

- A preparacao de imagens foi centralizada em `modules/finance/lib/image-upload.ts` para evitar tres implementacoes duplicadas de leitura de arquivo.
- Comprovantes passam a ser reduzidos para no maximo 1600px no maior lado, exportados como JPEG e comprimidos ate ficarem abaixo de 3,8 MB quando o navegador consegue decodificar a imagem.
- A rota server-side da MAYA passa a usar timeout interno de 7,5 segundos e declara `maxDuration = 10`, evitando que a Vercel encerre a funcao antes do fallback.
- A chamada de leitura solicita JSON estruturado e usa detalhe alto na imagem para melhorar OCR de notas, boletos e extratos.
- A leitura de comprovantes usa `OPENAI_VISION_MODEL` com fallback recomendado para `gpt-4o-mini`, mantendo `OPENAI_MODEL` para analises conversacionais.
- Falhas do provedor de IA agora sao classificadas em categorias seguras: autorizacao, limite, modelo, imagem, timeout, saida invalida, falha temporaria ou desconhecida.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- Imagens anexadas tendem a ficar menores antes de chegar ao backend, reduzindo erro por tamanho e custo de leitura.
- Imagens com transparencia passam a receber fundo branco ao serem convertidas para JPEG.
- Usuarios finais continuam vendo mensagens em linguagem de produto, sem variaveis, chaves, modelos ou detalhes internos.
- Desenvolvedores passam a conseguir diagnosticar a falha nos logs da Vercel pela chave `maya_receipt_read_failed`.
- Quando a IA demorar demais, o usuario deve receber rascunho manual em vez de erro 503/504.
- A rota limita imagens a 4 MB em data URL para respeitar o limite de payload da hospedagem.

## Pendencias

- Testar em producao com uma nota real apos redeploy e confirmar a categoria do log caso ainda falhe.
- Confirmar na Vercel que `OPENAI_API_KEY` esta preenchida e que `OPENAI_VISION_MODEL=gpt-4o-mini` esta ativa em Production e Preview.
- Implementar rate limiting nas rotas da MAYA antes de uso sensivel em escala.

## Proximos passos recomendados

- Fazer redeploy da Vercel apos subir o ZIP atualizado.
- Anexar uma foto JPG/PNG nitida de uma nota de despesa em `/expenses`.
- Se cair no rascunho manual, abrir os logs do deployment e procurar `maya_receipt_read_failed` para identificar a categoria exata.
