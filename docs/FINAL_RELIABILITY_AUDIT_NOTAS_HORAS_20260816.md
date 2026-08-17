# Auditoria final de confiabilidade — Notas e Horas

Data: 2026-08-16  
Fonte oficial desta revisao: `Maya-notas-horas-reliability-20260816.zip`

## Objetivo

Consolidar a versao mais recente da Maya sem regredir melhorias ja existentes e corrigir, de forma ponta a ponta, os fluxos de:

- leitura/importacao em massa de cartao de ponto;
- preservacao de batidas parciais;
- sincronizacao do ponto entre dispositivos;
- leitura de nota fiscal em imagem/PDF;
- criacao da nota como despesa financeira do mes;
- data fiscal incorreta;
- duplicidade de nota;
- persistencia e visualizacao do anexo;
- confiabilidade de upload em Vercel/Supabase.

## Resultado da varredura

O ZIP de origem era uma versao hibrida: continha melhorias recentes de nota e comprovante REP, mas ainda mantinha pontos antigos incompatíveis com producao, entre eles `pdf-parse` nas Functions e os fallbacks `08:00`/`18:00` em `normalizeWorkTimeEntries`.

A versao final preserva as melhorias recentes e consolida as correcoes abaixo.

## Correcoes implementadas

### 1. PDF de nota e ponto

- removida a dependencia `pdf-parse` e suas dependencias nativas/transitivas;
- removido `serverExternalPackages: ["pdf-parse"]`;
- PDF passa a ser enviado como `input_file` para a Responses API;
- suporta `file_url` assinada (preferencial) e `file_data` base64 (fallback pequeno);
- timeout das rotas ajustado para 60 s, mantendo timeout interno da chamada de IA abaixo desse teto;
- erros das duas rotas sao registrados com identificador seguro.

### 2. Upload sem estourar payload da Function

- PDF e enviado primeiro direto do navegador ao bucket privado do Supabase;
- apos upload, a Maya gera URL assinada por 10 minutos;
- a API recebe a URL curta em vez do PDF base64;
- fallback base64 foi reduzido para caber com folga no request da Function;
- a API aceita apenas URL HTTPS do host Supabase configurado, no bucket de anexos esperado, em rota assinada, com token e extensao PDF.

### 3. Cartao de ponto

- parser por contexto/blocos, sem depender de data e todas as batidas na mesma linha;
- cobre Secullum com data no inicio e no fim da linha;
- cobre extracao vertical;
- cobre comprovante REP individual com uma unica batida;
- ignora `Emitido em`, periodo, pagina, totais e linhas administrativas;
- linhas de folga/carga como `09:00 / 09:00` nao viram entrada;
- colunas de carga/falta nao sao confundidas com batidas em dias parciais;
- campos ausentes permanecem vazios;
- `startTime` existe somente com `firstIn` real;
- `endTime` existe somente com `secondOut` real;
- importacao de varios dias usa `upsertWorkTimeEntries()` em uma unica atualizacao de estado;
- merge entre nuvem/local deduplica por `person + date` usando a versao mais recente e preservando documentos.

### 4. Remocao de horarios artificiais

Foram eliminados os fallbacks `08:00` e `18:00` de dados carregados/importados. Uma batida parcial continua no campo em que foi efetivamente identificada. Dias sem registro tambem ficam vazios no PDF de relatorio exportado pela Maya.

Os horarios padrao continuam existindo apenas na experiencia de preenchimento manual de um novo dia, onde funcionam como valor inicial editavel e nao como dado importado.

### 5. Nota fiscal como despesa

- nota completa e salva como `Transaction` com `type: "expense"` e `source: "receipt"`;
- utiliza o mesmo motor de calculo mensal das despesas manuais;
- Dashboard e pagina Despesas seguem a mesma regra de efeito financeiro;
- anexo, itens e metadados fiscais permanecem na mesma transacao;
- `draft.missingFields` da IA continua informativo, mas nao decide sozinho se a despesa pode ser salva;
- requisitos financeiros sao recalculados a partir do draft normalizado.

### 6. Data fiscal e duplicidade

- chave fiscal e normalizada para 44 digitos;
- o AAMM da chave e usado para reconciliar ano/mes lido pelo OCR;
- datas muito antigas/futuras sem evidencia suficiente nao sao salvas silenciosamente;
- mesma chave fiscal e tratada como mesma identidade documental;
- reimportacao enriquece/atualiza o lancamento existente em vez de criar debito duplicado;
- deduplicacao de nuvem usa `type + accessKey`, evitando misturar receita e despesa por acidente.

## Testes e verificacoes executados nesta revisao

### Aprovados no ambiente disponivel

- parse sintatico de todos os arquivos TypeScript/TSX do projeto: zero erros de parse;
- typecheck estrito isolado do nucleo de IA;
- typecheck ampliado de 100 arquivos internos com tipagens externas simuladas; esse check encontrou e permitiu corrigir a tipagem do `Map<string, number>` na importacao de ponto em lote antes da entrega;
- typecheck estrito isolado de calculos financeiros;
- typecheck estrito de parser, data fiscal, duplicidade, migrations e state merge;
- typecheck do helper de URL assinada;
- typecheck da rotina de upload de documentos com dependencia Supabase simulada;
- teste de `input_file` PDF em base64 para ponto e nota;
- teste de `input_file` PDF por `file_url` assinada;
- parser Secullum com data no inicio;
- parser Secullum com data no fim;
- extracao vertical;
- batidas antes da data;
- comprovante REP individual;
- exclusao de cabecalho `Emitido em`;
- exclusao de folga `09:00 / 09:00`;
- preservacao de 2/3/4 batidas e campos faltantes;
- migracao sem inventar `08:00`/`18:00`;
- correcao de ano pela chave fiscal;
- rejeicao/revisao de data antiga sem chave;
- deduplicacao por chave fiscal;
- deduplicacao do ponto por pessoa + data no merge;
- despesa manual + nota participando do mesmo total mensal;
- consistencia entre `package.json` e `package-lock.json`;
- confirmacao de ausencia de `pdf-parse`, `pdfjs-dist` e `@napi-rs/canvas` no lock final.

### Suite completa npm

A reinstalacao com `npm ci` nao pode ser concluida dentro do sandbox desta auditoria porque o ambiente nao conseguiu resolver `registry.npmjs.org` (falha de DNS/rede). Por esse motivo, nao e correto declarar que `npm test` e `npm run build` completos foram executados aqui.

Para transformar isso em um bloqueio objetivo antes de producao, foi adicionado `.github/workflows/quality.yml`. Em ambiente GitHub com acesso ao registry, cada push para `main` e cada pull request executam obrigatoriamente:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

O deploy deve ser considerado aprovado somente com esse workflow verde.

## Arquivos de maior impacto

- `app/api/_shared/attachment-url.ts`
- `app/api/maya/receipt/route.ts`
- `app/api/maya/timecard/route.ts`
- `modules/ai/maya.ts`
- `modules/ai/timecard-report-parser.ts`
- `modules/finance/components/expenses-page.tsx`
- `modules/finance/components/finance-dashboard.tsx`
- `modules/finance/components/work-hours-page.tsx`
- `modules/finance/lib/duplicates.ts`
- `modules/finance/lib/fiscal-date.ts`
- `modules/finance/lib/image-upload.ts`
- `modules/finance/lib/migrations.ts`
- `modules/finance/lib/receipt-validation.ts`
- `modules/finance/lib/state-merge.ts`
- `modules/finance/lib/use-finance-store.ts`
- `tests/*` relacionados a nota/ponto
- `.github/workflows/quality.yml`

## Criterio final de deploy

1. Subir o conteudo do ZIP na raiz do repositorio.
2. Confirmar o Quality Gate verde no GitHub.
3. Confirmar as variaveis `OPENAI_API_KEY`, `OPENAI_MODEL`/`OPENAI_PDF_MODEL`, Supabase e bucket na Vercel.
4. Fazer deploy/redeploy.
5. Em producao, testar um PDF real de ponto com varios dias e conferir quantidade/datas/batidas.
6. Recarregar e verificar persistencia do ponto.
7. Enviar uma nota PDF real, conferir a despesa no mes correto e o novo total mensal.
8. Reenviar a mesma nota e confirmar que nao existe segundo debito.
9. Abrir o anexo da nota e confirmar acesso via Storage.

Nenhuma revisao estatica pode garantir comportamento de producao sem o build real, variaveis reais e servicos externos. Esta versao foi preparada para transformar essas verificacoes restantes em gates claros e reproduziveis, sem mascarar falhas como sucesso.
