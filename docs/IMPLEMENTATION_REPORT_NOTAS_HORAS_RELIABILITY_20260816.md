# Implementation Report - Notas e Horas

Data: 2026-08-16

## Arquivos modificados

- `modules/finance/components/expenses-page.tsx`
- `modules/ai/timecard-report-parser.ts`
- `modules/ai/maya.ts`
- `tests/timecard-report.test.ts`
- `docs/CHANGELOG.md`

## Decisoes arquiteturais

- O envio de nota em `Despesas` agora salva automaticamente como despesa quando ha valor positivo e data real identificada, mesmo que a IA nao tenha retornado uma descricao perfeita.
- A descricao da despesa de nota usa uma ordem conservadora e auditavel: descricao lida, titulo, emissor fiscal, destinatario do pagamento ou nome do arquivo. O sistema nao inventa valor nem data.
- Quando faltam valor ou data, a nota permanece como revisao editavel com anexo visivel, para evitar soma falsa.
- O parser de ponto passou a montar candidatos por blocos, cobrindo relatorios onde data e horarios aparecem separados por colunas/linhas.
- Uma batida unica de comprovante individual passa a ser classificada pela faixa de horario, evitando tratar uma saida final como entrada do dia.

## Dependencias adicionadas

- Nenhuma dependencia nova foi adicionada.

## Possiveis impactos

- Notas com valor e data entram mais rapidamente no mes correto, reduzindo anexos "escondidos" fora da soma.
- Em caso de duplicidade por mesmo dia e mesmo valor, o fluxo continua pedindo confirmacao para vincular a nota ao lancamento existente ou computar novo lancamento.
- Relatorios Secullum/Romep em PDF com texto estruturado passam a alimentar varios dias na aba `Horas`, mantendo os registros editaveis.

## Validacao

- `npm run typecheck`
- `npm test`
- `npm run build`

## Pendencias

- PDFs de ponto puramente escaneados, sem texto extraivel, ainda dependem da leitura por imagem/IA.
- A leitura fiscal via QR Code depende da disponibilidade publica da SEFAZ e das chaves de IA configuradas na Vercel.

## Proximos passos recomendados

- Testar em producao com o mesmo PDF `dey cartao de ponto.pdf`.
- Enviar uma nota com valor/data legiveis pelo celular e confirmar no desktop se ela aparece no mes da nota com anexo visivel.
