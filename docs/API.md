# API

Este documento define os padroes para criacao e evolucao de APIs.

## Principios

- Contratos claros.
- Validacao explicita.
- Erros consistentes.
- Autorizacao no backend.
- Paginacao em listagens.
- Versionamento ou politica de compatibilidade.
- Observabilidade por requisicao.

## Estado atual

O MVP funcional inicial usa persistencia local versionada para transacoes, metas e orcamentos. Ainda nao existem APIs reais de persistencia financeira, mas ja existem rotas server-side da MAYA para analise e leitura de comprovantes.

Quando o backend for ativado, as primeiras APIs deverao cobrir:

- `GET /api/finance/summary`.
- `GET /api/finance/transactions`.
- `POST /api/finance/transactions`.
- `PATCH /api/finance/transactions/:id`.
- `DELETE /api/finance/transactions/:id`.
- `GET /api/goals`.
- `POST /api/goals`.
- `PATCH /api/goals/:id`.
- `GET /api/budgets`.
- `POST /api/budgets`.
- `DELETE /api/budgets/:id`.
- `POST /api/ai/insights`.
- `POST /api/maya/analyze`.
- `POST /api/maya/receipt`.
- `GET /api/whatsapp/webhook`.
- `POST /api/whatsapp/webhook`.
- `GET /api/system/status`.

Esses endpoints devem validar usuario, organizacao e permissao antes de acessar dados.

## Endpoints MAYA

## Endpoints de sistema

### `GET /api/system/status`

Objetivo: informar ao frontend quais capacidades estao configuradas no servidor sem expor segredos.

Entrada: nenhuma.

Saida:

- `maya.available`: indica que a assistente esta disponivel.
- `maya.level`: `advanced` ou `essential`, sem revelar provedor, modelo ou configuracao.
- `backup.available`: indica que backup manual esta disponivel.
- `whatsapp.available`: indica se o recebimento via WhatsApp esta configurado.
- `connections.status`: `future`, pois nao ha integracao financeira real nesta etapa.
- `connections.message`: mensagem segura em linguagem de produto.

Regra: nunca retornar chaves, tokens, URLs sensiveis privadas, valores de segredo, modelos, variaveis de ambiente ou nomes de infraestrutura.

### `POST /api/maya/analyze`

Objetivo: gerar uma analise financeira conversacional da MAYA.

Entrada:

- Estado financeiro atual.
- Pergunta do usuario.
- Comparativos mensais calculados no cliente.

Validacao: a rota normaliza o estado financeiro recebido antes da analise para evitar falhas com dados locais antigos ou parcialmente invalidos.

Saida:

- `assistantName`.
- `message`.
- `highlights`.
- `nextActions`.

Fallback: se a analise avancada nao estiver disponivel, retornar analise segura baseada nos dados cadastrados.
Quando nao houver dados reais suficientes, a resposta deve informar insuficiencia de dados em vez de gerar diagnostico financeiro.

### `POST /api/maya/receipt`

Objetivo: ler imagem de nota, cupom ou comprovante e sugerir uma despesa.

Entrada:

- Imagem em base64/data URL.
- Nome do arquivo.

Validacao: a imagem deve ser `data:image/*` e respeitar limite maximo de tamanho antes de qualquer leitura por IA.

Saida:

- `expenseDraft` com descricao, valor, categoria, data, confianca e itens quando disponiveis.
- `needsReview`: sempre `true`.

Regra: a despesa so deve ser salva depois da confirmacao do usuario.
Fallback: se a leitura nao ocorrer, retornar rascunho pendente com valor zero, categoria neutra e `needsReview: true`, sem inferir dados da nota.

## Endpoints WhatsApp

### `GET /api/whatsapp/webhook`

Objetivo: validar o webhook configurado na Meta.

Entrada:

- `hub.mode`.
- `hub.verify_token`.
- `hub.challenge`.

Saida:

- `200` com o desafio quando o token estiver correto.
- `403` quando o token nao bater.

### `POST /api/whatsapp/webhook`

Objetivo: receber mensagens do WhatsApp Cloud API, identificar imagens de comprovantes e acionar a MAYA para criar rascunho revisavel.

Entrada:

- Payload JSON enviado pela Meta no webhook `messages`.
- Header `x-hub-signature-256` quando `WHATSAPP_APP_SECRET` estiver configurado.

Saida:

- `200` com `received: true` para eventos aceitos.

Regras:

- Validar assinatura do webhook quando o segredo do app existir.
- Ignorar eventos sem mensagem de imagem.
- Baixar midia apenas via rota server-side.
- Nunca salvar despesa automaticamente a partir do WhatsApp.
- Responder ao usuario com resumo curto e orientacao para revisar no app.
- Nao expor tokens, IDs internos ou detalhes de provedor em mensagens ao usuario.

## Estilo recomendado

A escolha final dependera da stack, mas REST ou RPC tipado podem ser usados. A decisao deve considerar:

- Facilidade de consumo pelo frontend.
- Tipagem e geracao de contratos.
- Testabilidade.
- Compatibilidade futura com terceiros.
- Documentacao automatizavel.

## Padrao REST quando aplicavel

- Recursos no plural: `/users`, `/organizations`, `/projects`.
- Usar metodos HTTP conforme semantica.
- `GET` nao deve alterar estado.
- `POST` cria ou executa acoes nao idempotentes.
- `PUT` substitui recurso.
- `PATCH` altera parcialmente.
- `DELETE` remove ou marca para remocao conforme regra documentada.

## Respostas

Respostas devem ser previsiveis e evitar expor detalhes internos.

Listagens devem considerar:

- Paginacao.
- Ordenacao.
- Filtros.
- Total ou cursor quando necessario.

## Erros

Categorias minimas:

- `400`: entrada invalida.
- `401`: nao autenticado.
- `403`: sem permissao.
- `404`: recurso nao encontrado.
- `409`: conflito de estado.
- `422`: regra de negocio invalida, quando a stack adotar essa distincao.
- `429`: limite excedido.
- `500`: erro inesperado.

Erros devem conter codigo estavel, mensagem segura e detalhes de validacao quando apropriado.

## Autenticacao e autorizacao

- A API deve validar identidade e permissao.
- Escopo de organizacao deve ser considerado em recursos multi-tenant.
- O frontend nunca deve ser a unica barreira de acesso.

## APIs com IA

Endpoints que acionam IA devem definir:

- Entrada permitida.
- Limites de tamanho.
- Tempo maximo.
- Politica de custo.
- Saida esperada.
- Fallback.
- Auditoria.

## Documentacao de endpoints

Cada endpoint deve registrar:

- Metodo e caminho.
- Objetivo.
- Permissoes.
- Entrada.
- Saida.
- Erros esperados.
- Efeitos colaterais.

## Endpoints atuais

### POST `/api/maya/receipt`

Objetivo: ler uma imagem financeira enviada pelo usuario e devolver um rascunho revisavel.

Permissoes: sem autenticacao nesta etapa local, mas sem exposicao de segredos ao frontend.

Entrada:

- `imageDataUrl`: imagem em data URL.
- `fileName`: nome do arquivo, opcional.
- `documentKind`: `expense`, `income` ou `bill`, opcional.

Saida:

- `financialDraft`: rascunho normalizado de despesa, renda ou conta a pagar.
- `expenseDraft`: compatibilidade com a primeira versao de despesas por nota.
- `needsReview`: sempre `true`.
- `message`: orientacao curta para revisao.

Regras:

- A rota limita tamanho de imagem.
- A rota usa `OPENAI_API_KEY` apenas no servidor.
- Quando a OpenAI nao estiver configurada ou falhar, retorna rascunho seguro com campos essenciais vazios.
- A IA nao deve inventar titulo, valor, vencimento, descricao ou codigo quando a imagem nao sustentar a informacao.
- A IA pode retornar itens de nota ou linhas de extrato em `items`, mas esses itens sao informativos ate que o usuario confirme o lancamento.
- O frontend deve exigir preenchimento manual dos campos obrigatorios antes de salvar.
- O frontend deve verificar duplicidade por data, valor e tipo antes de persistir renda ou despesa.
- Quando houver possivel duplicidade, o frontend deve pedir confirmacao explicita do usuario.

Erros esperados:

- `400`: imagem ausente ou invalida.
- `413`: imagem maior que o limite permitido.
- `500`: falha inesperada de leitura.

Efeitos colaterais:

- Nenhum dado financeiro e salvo pela API.
- O salvamento acontece somente no cliente apos confirmacao do usuario.

## Pendencias

- Definir abordagem de API apos escolha da stack.
- Definir formato padrao de erro.
- Definir estrategia de documentacao automatica.
