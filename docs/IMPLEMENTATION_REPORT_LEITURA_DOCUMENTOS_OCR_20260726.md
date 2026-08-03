# Implementation Report - Leitura de Documentos OCR

Data: 2026-07-26

## Arquivos criados

- `docs/IMPLEMENTATION_REPORT_LEITURA_DOCUMENTOS_OCR_20260726.md`

## Arquivos modificados

- `app/api/maya/receipt/route.ts`
- `app/api/maya/statement/route.ts`
- `modules/ai/maya.ts`
- `modules/finance/lib/image-upload.ts`
- `docs/API.md`
- `docs/CHANGELOG.md`
- `docs/DEPLOYMENT.md`
- `docs/IA_GUIDELINES.md`

## Decisoes arquiteturais tomadas

- A leitura de comprovantes continua centralizada no backend em `/api/maya/receipt` e `/api/maya/statement`, mantendo chaves da OpenAI fora do navegador.
- O preparo de imagem no cliente passou a preservar mais resolucao e qualidade JPEG antes do envio, porque nota fiscal, DANFE e extrato dependem de texto pequeno e muitos itens legiveis.
- O timeout interno da chamada OpenAI foi ampliado para documentos mais densos, sem remover fallback seguro para rascunho manual quando houver falha.
- Os prompts foram reforcados para orientar OCR minucioso antes da classificacao, cobrindo nota, DANFE NF-e/NFC-e, cupom fiscal, boleto, Pix, fatura, recibo, renda e extrato.
- A normalizacao de saida passou a aceitar nomes de campos comuns em portugues e variacoes retornadas pelo modelo, evitando descarte de dados validos por diferenca de nomenclatura.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- A leitura tende a captar mais itens, datas, destinatarios, vencimentos, codigos Pix/boleto e dados fiscais.
- Imagens enviadas para leitura podem ficar maiores que antes, dentro do novo limite aceito pela API.
- Chamadas de leitura podem durar mais em documentos longos; a interface continua exigindo revisao humana antes de salvar.
- Se o plano da Vercel limitar duracao de funcao abaixo de `maxDuration = 25`, os logs ainda podem indicar timeout externo.

## Pendencias

- Testar em producao com notas reais de mercado, DANFE/NFC-e, boleto, comprovante Pix e extrato bancario.
- Monitorar logs `maya_receipt_read_failed` para confirmar se as falhas restantes sao por chave, timeout, tamanho de imagem ou indisponibilidade externa.
- Avaliar OCR dedicado no futuro se a OpenAI ainda perder muitos itens em documentos extensos ou com baixa qualidade.

## Proximos passos recomendados

- Validar a leitura em celular e desktop com o mesmo anexo.
- Conferir se os anexos salvos no Supabase Storage abrem dentro do app sem download.
- Criar uma fila de exemplos reais anonimizados para regressao manual de leitura da MAYA.
