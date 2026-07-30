# Implementation Report - Leitura de Fotos e Documentos

Data: 2026-07-30

## Arquivos criados

- `docs/IMPLEMENTATION_REPORT_LEITURA_FOTOS_DOCUMENTOS_20260730.md`

## Arquivos modificados

- `modules/ai/maya.ts`
- `modules/finance/lib/image-upload.ts`
- `docs/API.md`
- `docs/CHANGELOG.md`
- `docs/IA_GUIDELINES.md`

## Decisoes arquiteturais tomadas

- A leitura de fotos continua centralizada no backend, mantendo `OPENAI_API_KEY` fora do navegador.
- O prompt da MAYA foi refinado para documentos financeiros brasileiros, com foco em DANFE NF-e, DANFE NFC-e, cupom fiscal, boleto, Pix, comprovantes e extratos.
- A normalizacao passou a aceitar mais aliases de campos que podem aparecer em respostas de OCR, como `itens`, `produtos`, `emitente`, `favorecido`, `linhaDigitavel`, `pixCopiaCola`, `valorPago`, `valorAPagar`, `valorLiquido` e `valorFinal`.
- Linhas de extrato com valores negativos agora podem ser preservadas como despesas, usando valor positivo e `type = expense`, evitando descarte de transacoes reais.
- Datas acompanhadas de horario ou texto extra agora podem ser normalizadas quando houver data valida legivel.
- A preparacao de imagem no cliente passou a preservar um pouco mais de resolucao e qualidade para melhorar leitura de texto pequeno.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- A MAYA tende a preencher mais campos em notas, DANFEs, boletos, Pix e extratos.
- Imagens de anexo podem ficar maiores, dentro de limite controlado para evitar erro de payload.
- Extratos que antes perdiam linhas por valor negativo passam a importar mais lancamentos para revisao.

## Pendencias

- Validar com fotos reais de nota de mercado, DANFE/NFC-e, boleto, comprovante Pix e extrato bancario em producao.
- Conferir nos logs da Vercel se falhas restantes sao causadas por chave OpenAI, timeout, tamanho do arquivo ou indisponibilidade externa.
- Avaliar OCR dedicado no futuro se documentos longos ou muito desfocados continuarem com baixa captura.

## Proximos passos recomendados

- Testar a mesma nota pelo celular e conferir no desktop se os dados, itens e anexo aparecem.
- Criar uma pequena base de exemplos anonimizados para repetir testes de leitura sempre que a MAYA for alterada.
