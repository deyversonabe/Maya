# Implementation Report - Horas PDF, recorrencias e conciliacao

Data: 2026-08-14

## Arquivos criados

- `docs/IMPLEMENTATION_REPORT_HORAS_PDF_RECORRENCIAS_CONCILIACAO_20260814.md`

## Arquivos modificados

- `app/api/maya/timecard/route.ts`
- `modules/ai/maya.ts`
- `modules/finance/components/work-hours-page.tsx`
- `modules/finance/components/bills-page.tsx`
- `modules/finance/components/income-statement-page.tsx`
- `modules/finance/components/months-page.tsx`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/lib/image-upload.ts`
- `modules/finance/lib/migrations.ts`
- `next.config.mjs`
- `docs/CHANGELOG.md`
- `docs/FEATURES.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `package.json`
- `package-lock.json`

## Decisoes arquiteturais

- A leitura de relatorio de ponto em PDF usa extracao de texto no servidor antes de recorrer a OCR, porque relatorios prontos costumam ter texto estruturado mais confiavel que imagem.
- `pdf-parse` foi marcado como pacote externo do servidor no Next para evitar quebra de runtime durante o bundle da API.
- `POST /api/maya/timecard` passa a aceitar imagem e PDF. Imagem continua gerando rascunho revisavel; PDF com varias datas alimenta o calendario e mantem cada dia editavel.
- O parser de ponto ignora carga normal e faltas como batidas. Exemplo: `09:00` de coluna `NORMAIS` nao vira entrada/saida.
- Contas recorrentes ou parceladas criadas como pagas agora mantem apenas a primeira ocorrencia paga. Futuras ocorrencias nascem pendentes.
- A normalizacao do estado corrige dados antigos em que varias recorrencias do mesmo grupo foram marcadas pagas antecipadamente no mesmo dia.
- No extrato, o saldo anterior nao soma lancamentos marcados como futuros.
- Na conciliacao, quando nota e extrato apontam para mesma despesa por data e valor, a nota prevalece para descricao, itens e dados fiscais sem criar novo debito.

## Dependencias adicionadas

- `pdf-parse`: extracao de texto de PDFs de ponto no backend.

## Possiveis impactos

- Relatorios de ponto em PDF com texto interno devem importar varias datas automaticamente.
- PDFs escaneados sem texto ainda podem depender de OCR por imagem; nesses casos, a qualidade da imagem influencia a leitura.
- Dados antigos de contas recorrentes pagas em massa podem mudar de `paid` para `pending` nas ocorrencias futuras do mesmo grupo.
- Contas futuras seguem visiveis na aba Contas como planejamento, mas deixam de contaminar saldo realizado e recorrentes pagos.

## Pendencias

- Testar em producao com Supabase real se os registros importados por PDF aparecem em outro aparelho apos sincronizacao.
- Avaliar suporte futuro a PDF de extrato bancario; nesta etapa a importacao de extrato permanece pelo fluxo existente de imagem.
- Criar ferramenta administrativa para revisar e corrigir em lote dados antigos duplicados, se ainda houver duplicidades manuais reais.

## Proximos passos recomendados

- Fazer deploy na Vercel e testar o arquivo `dey cartao de ponto.pdf` na aba Horas.
- Confirmar que o aluguel recorrente novo cria apenas a primeira ocorrencia como paga quando selecionado `pago`.
- Anexar uma nota a uma despesa existente do extrato e conferir se os itens aparecem no detalhe sem novo valor.
