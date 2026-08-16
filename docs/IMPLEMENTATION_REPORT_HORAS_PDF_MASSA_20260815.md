# Implementation Report - Horas PDF em Massa

Data: 2026-08-15

## Objetivo

Corrigir a aba `Horas` para ler relatorios de ponto em PDF, identificar varios dias e preencher em massa os registros diarios com quatro batidas editaveis: entrada, saida para almoco, retorno do almoco e saida final.

## Arquivos criados

- `modules/ai/timecard-report-parser.ts`
- `tests/timecard-report.test.ts`
- `docs/IMPLEMENTATION_REPORT_HORAS_PDF_MASSA_20260815.md`

## Arquivos modificados

- `modules/ai/maya.ts`
- `docs/CHANGELOG.md`
- `docs/FEATURES.md`
- `docs/API.md`

## Decisoes arquiteturais

- A leitura de relatorio mensal de ponto em PDF foi isolada em um parser puro (`timecard-report-parser.ts`) para permitir teste automatizado sem depender da chamada de IA.
- O endpoint `POST /api/maya/timecard` continua sendo a entrada unica da aba Horas; quando recebe PDF, extrai texto no servidor e passa o conteudo para o parser estruturado.
- O parser foi ajustado para formatos de relatorio com data no fim da linha, como Secullum/Romep, onde a primeira batida pode aparecer depois das colunas de resumo no texto extraido.
- Horas administrativas do relatorio, como `NORMAIS`, `FALTAS`, saldos e duracoes, nao sao tratadas como batidas reais.
- A carga esperada continua seguindo a regra interna da Maya: segunda a sexta com 528 minutos esperados e sabado/domingo com 0 minuto, mantendo edicao manual por dia.

## Dependencias adicionadas

- Nenhuma dependencia nova nesta entrega.

## Possiveis impactos

- Relatorios de ponto com texto estruturado passam a importar varios dias automaticamente.
- Registros incompletos entram no calendario com campos vazios e `missingFields`, permitindo revisao e edicao posterior.
- Relatorios escaneados sem texto interno ainda dependem da leitura por imagem/OCR.

## Pendencias

- Testar em producao com o arquivo real `dey cartao de ponto.pdf` na aba Horas apos deploy.
- Coletar outros modelos de relatorio de ponto para ampliar a cobertura do parser quando necessario.

## Validacao

- `npm run test`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`
