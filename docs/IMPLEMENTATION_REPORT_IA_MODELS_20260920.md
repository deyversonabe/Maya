# Atualizacao de IA — 20/09/2026

## Objetivo

Atualizar a MAYA para uma geracao mais recente de modelos OpenAI sem alterar a arquitetura financeira nem remover os fallbacks deterministicos do sistema.

## Configuracao recomendada

```env
OPENAI_MODEL=gpt-6-astra
OPENAI_PDF_MODEL=gpt-5.6-terra
OPENAI_VISION_MODEL=gpt-5.6-terra
```

## Estrategia

- `gpt-6-astra`: analise financeira, conversa e interpretacao contextual da MAYA.
- `gpt-5.6-terra`: OCR e extracao estruturada de comprovantes, extratos, notas e PDFs, evitando o custo do Astra em tarefas repetitivas de alto volume.
- A Responses API existente foi preservada.
- `OPENAI_API_KEY` continua somente no servidor.
- Os fallbacks locais continuam ativos quando a API estiver ausente ou falhar.

## Importante na Vercel

Se o projeto ja possui `OPENAI_MODEL`, `OPENAI_PDF_MODEL` ou `OPENAI_VISION_MODEL` configurados na Vercel, esses valores sobrescrevem os defaults do codigo. Portanto, atualize as tres variaveis no ambiente Production (e Preview, se usado) e faca novo deploy.

## Alternativas

Para maior qualidade, com custo significativamente maior, os tres campos podem usar `gpt-6-astra`. Para reduzir custo, `gpt-5.6-terra` pode ser usado tambem em `OPENAI_MODEL`.
