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
- `POST /api/maya/statement`.
- `POST /api/maya/timecard`.
- `GET /api/whatsapp/webhook`.
- `POST /api/whatsapp/webhook`.
- `GET /api/system/status`.
- `GET /api/admin/overview`.
- `POST /api/admin/member-status`.
- `POST /api/notifications/subscribe`.
- `GET|POST /api/notifications/send-due-alerts`.

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
- `reports.pdf` e `reports.excel`: indicam exportacoes profissionais disponiveis no navegador.
- `sync.available`: indica que conta online e sincronizacao estao configuradas.
- `admin.available`: indica se a service role foi configurada no servidor para painel admin.
- `push.available`: indica se chaves VAPID e segredo de cron estao configurados.
- `storage.available`: indica se o deploy tem Supabase configurado para usar bucket privado de anexos.
- `storage.bucket`: nome publico nao sensivel do bucket esperado para comprovantes.
- `pwa.available`: indica que instalacao pelo navegador esta habilitada.
- `pwa.cache`: descreve a politica de cache do service worker.
- `whatsapp.available`: indica se o recebimento via WhatsApp esta configurado.
- `connections.status`: `future`, pois nao ha integracao financeira real nesta etapa.
- `connections.message`: mensagem segura em linguagem de produto.

Regra: nunca retornar chaves, tokens, URLs sensiveis privadas, valores de segredo, modelos, variaveis de ambiente ou nomes de infraestrutura.

### `GET /api/admin/overview`

Objetivo: retornar dados administrativos do workspace para usuario com papel `admin`.

Entrada:

- Header `Authorization: Bearer <access_token>` da sessao Supabase.

Saida:

- Usuarios autorizados, papel, status, ultimo acesso e quantidade de inscricoes push.
- Saude da sincronizacao do workspace.
- Estado da configuracao de push sem expor chaves.
- Contadores de transacoes, contas, metas, orcamentos e logs.

Seguranca:

- Usa `SUPABASE_SERVICE_ROLE_KEY` somente no servidor.
- Verifica se o usuario autenticado e `deyversonsilvaf@gmail.com`, membro ativo e com papel `admin`.
- Nunca retorna tokens ou segredos.

### `POST /api/admin/member-status`

Objetivo: permitir que administrador bloqueie ou reative usuario do workspace.

Entrada:

- Header `Authorization: Bearer <access_token>`.
- Body JSON com `userId` e `status` (`active` ou `blocked`).

Regra:

- Administrador nao pode bloquear a propria conta.
- Apenas `deyversonsilvaf@gmail.com` pode executar a acao.
- Usuario bloqueado deixa de passar pela funcao `is_finance_workspace_member`.

## RPC Supabase de sincronizacao

### `save_finance_workspace_state_locked`

Objetivo: salvar o estado financeiro compartilhado sem sobrescrever silenciosamente alteracoes concorrentes.

Entrada:

- `p_workspace_id`: identificador do workspace.
- `p_state`: `FinanceState` em JSONB.

Saida:

- `state`: estado mesclado e salvo.
- `updated_at`: data/hora persistida no banco.

Regras:

- Exige usuario autenticado e membro ativo do workspace.
- Usa `SELECT ... FOR UPDATE` para serializar escritas sobre a mesma linha.
- Mescla listas por `id` para preservar lancamentos, contas, metas, orcamentos, documentos fiscais, dados trabalhistas, holerites, horas e logs criados por outra sessao.
- Clientes autenticados nao devem fazer `upsert` direto em `finance_workspace_states`.

### `POST /api/notifications/subscribe`

Objetivo: salvar a inscricao push do navegador/aparelho do usuario autenticado.

Entrada:

- Header `Authorization: Bearer <access_token>`.
- Body JSON da `PushSubscription` do navegador.

Saida:

- `{ ok: true }` quando a inscricao foi salva.

### `GET|POST /api/notifications/send-due-alerts`

Objetivo: rotina agendada para enviar push real de contas vencendo, contas atrasadas e alertas de saude financeira.

Seguranca:

- Exige `Authorization: Bearer <CRON_SECRET>` ou `?secret=<CRON_SECRET>`.
- Usa VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- Registra entregas em `finance_push_deliveries` para reduzir repeticao de alertas.

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

Camada local obrigatoria:

- Antes de chamar OpenAI, a rota deve verificar se a pergunta pede calculo de juros, avaliacao de emprestimo/financiamento ou negociacao de conta atrasada.
- Quando a pergunta estiver nesse escopo, a resposta deve ser gerada por ferramenta local deterministica, sem depender de provedor externo.
- A ferramenta local deve preservar `healthScore` e `trend` calculados pelo estado financeiro atual.
- As respostas devem declarar estimativas e pedir CET, taxas, IOF, tarifas, valor liberado, parcelas e demonstrativo de divida quando faltarem dados.
- A orientacao deve usar conceitos brasileiros de forma educativa e nao deve inventar leis, artigos ou taxas oficiais.

### `POST /api/maya/receipt`

Objetivo: ler imagem de nota, cupom, comprovante, boleto, Pix ou conta e sugerir um rascunho financeiro revisavel.

Entrada:

- Imagem em base64/data URL.
- Nome do arquivo.
- `documentKind`: `expense`, `income` ou `bill` quando a tela ja souber o destino.

Validacao: a imagem deve ser `data:image/*` e respeitar limite maximo de tamanho antes de qualquer leitura por IA.

Saida:

- `financialDraft` com tipo, titulo, descricao, valor, categoria, datas, pagamento, itens e campos pendentes.
- `expenseDraft` mantido por compatibilidade com fluxo de despesa.
- `needsReview`: sempre `true`.

Regra: nenhuma transacao ou conta deve ser salva depois da leitura sem confirmacao do usuario.
Fallback: se a leitura nao ocorrer, retornar rascunho pendente com valor zero, categoria neutra e `needsReview: true`, sem inferir dados da nota.

### `POST /api/maya/timecard`

Objetivo: ler imagem de registro de ponto ou espelho de ponto e sugerir rascunho revisavel de horas trabalhadas.

Entrada:

- Imagem em base64/data URL.
- Nome do arquivo.
- `targetDate`: data selecionada no calendario, quando existir.

Validacao: a imagem deve ser `data:image/*` e respeitar limite maximo de tamanho antes de qualquer leitura por IA.

Saida:

- `timeClockDraft` com `date`, `firstIn`, `firstOut`, `secondIn`, `secondOut`, `startTime`, `endTime`, `lunchMinutes`, `expectedMinutes`, `confidence`, `missingFields`, `punches` e `notes`.
- `needsReview`: sempre `true`.

Regras:

- A rota deve ignorar cabecalhos, matricula, empresa, CNPJ, assinatura, totais legais e textos administrativos.
- Quando a data alvo aparecer no documento, a leitura deve priorizar essa data.
- Quando houver quatro batidas, a primeira vira entrada, a ultima vira saida e a diferenca entre segunda e terceira vira intervalo.
- Quando houver comprovante individual com apenas `DATA` e `HORA`, a rota deve preencher somente a batida provavel (`firstIn`, `firstOut`, `secondIn` ou `secondOut`) e manter as demais pendentes.
- Quando a leitura nao identificar data ou horarios confiaveis, deve manter campos pendentes em vez de inventar.
- Nenhum registro de horas deve ser salvo sem confirmacao do usuario na tela `Horas`.

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
- `financialDraft.fiscalDocument`: metadados fiscais opcionais para DANFE NF-e, DANFE NFC-e e cupom fiscal, incluindo tipo, chave de acesso, emissor, CNPJ, numero, serie, protocolo e totais quando legiveis.
- `needsReview`: sempre `true`.
- `message`: orientacao curta para revisao.

Regras:

- A rota limita tamanho de imagem a 7 MB em data URL para preservar texto pequeno de notas, DANFE e extratos.
- A rota usa `OPENAI_API_KEY` apenas no servidor.
- A rota declara `maxDuration = 25` e usa timeout interno controlado para reduzir falhas em documentos longos sem travar a interface.
- A rota solicita saida JSON estruturada e rejeita respostas vazias ou malformadas.
- Quando a OpenAI nao estiver configurada ou falhar, retorna rascunho seguro com campos essenciais vazios.
- A IA nao deve inventar titulo, valor, vencimento, descricao ou codigo quando a imagem nao sustentar a informacao.
- Em DANFE/NF-e/NFC-e/cupom fiscal, a IA deve usar o valor total da nota ou valor pago como `amount` e manter chave de acesso/CNPJ apenas quando legiveis.
- A IA pode retornar itens de nota ou linhas de extrato em `items`, mas esses itens sao informativos ate que o usuario confirme o lancamento.
- A normalizacao aceita aliases comuns de documentos brasileiros, incluindo `itens`, `produtos`, `emitente`, `favorecido`, `pixCopiaCola`, `linhaDigitavel`, `valorPago`, `valorAPagar`, `valorLiquido` e `valorFinal`.
- Datas podem vir em ISO, formato brasileiro ou acompanhadas de hora/texto; o backend so preserva a data quando ela puder ser validada.
- O frontend deve exigir preenchimento manual dos campos obrigatorios antes de salvar.
- O frontend deve verificar suspeita de duplicidade por data, valor e tipo antes de persistir renda ou despesa.
- O frontend tambem deve alertar quando houver mesmo valor no mesmo dia, mesmo que o tipo tenha sido classificado diferente.
- Quando houver possivel duplicidade, o frontend deve pedir decisao explicita para computar ou excluir o novo registro.
- O frontend deve otimizar imagens de anexo para JPEG antes do envio quando o navegador conseguir decodificar o arquivo, preservando resolucao suficiente para OCR.
- Logs tecnicos devem categorizar falhas de leitura sem expor chave, imagem ou conteudo sensivel.

Erros esperados:

- `400`: imagem ausente ou invalida.
- `413`: imagem maior que o limite permitido.
- `500`: falha inesperada de leitura.

Efeitos colaterais:

- Nenhum dado financeiro e salvo pela API.
- O salvamento acontece somente no cliente apos confirmacao do usuario.

### POST `/api/maya/statement`

Objetivo: ler uma imagem de extrato bancario e devolver linhas revisaveis separadas entre renda e despesa.

Permissoes: mesma regra da rota de comprovante; a chave de IA permanece somente no servidor.

Entrada:

- `imageDataUrl`: imagem em data URL.
- `fileName`: nome do arquivo, opcional.

Saida:

- `statementDraft`: rascunho com titulo, periodo, confianca, anexo e `lines`.
- `lines`: tipo (`income` ou `expense`), descricao, valor, data, categoria, pessoa, forma de pagamento, destinatario Pix e observacoes.
- `needsReview`: sempre `true`.
- `message`: orientacao curta para revisao.

Regras:

- A rota aceita somente `data:image/*` e limita payload antes da chamada de IA.
- A MAYA deve ignorar saldo, total, cabecalho, limite, subtotal e qualquer linha que nao seja transacao real.
- Valores retornam positivos; o campo `type` indica entrada ou saida.
- Se a IA ou o extrato retornar um valor negativo em uma linha de saida, o backend normaliza o valor como positivo e preserva `type = expense`.
- A normalizacao aceita linhas em `lines`, `linhas`, `transactions`, `transacoes` ou `items`, desde que cada linha tenha tipo/direcao, descricao, valor e data confiaveis.
- Quando a linha for Pix e o destinatario/remetente estiver legivel, preencher `paymentRecipient`.
- Quando nao houver categoria confiavel, usar `Outros`.
- O frontend deve permitir editar as linhas antes de salvar.
- O frontend deve verificar duplicidade por tipo, data e valor antes de importar.
- O frontend tambem deve notificar valor repetido no mesmo dia dentro do proprio extrato ou contra dados ja salvos.
- Nenhum dado financeiro e salvo pela API; salvamento acontece somente apos confirmacao humana.

Erros esperados:

- `400`: imagem ausente ou invalida.
- `413`: imagem maior que o limite permitido.
- `500`: falha inesperada de leitura.

### POST `/api/maya/validate`

Objetivo: revisar um lancamento candidato antes de salvar, identificando dados incompletos, possivel duplicidade e possivel transferencia interna.

Permissoes: sem autenticacao nesta etapa local.

Entrada:

- `state`: estado financeiro atual.
- `candidate`: lancamento candidato com tipo, descricao, valor, categoria, pessoa e data.

Saida:

- `ok`: indica se nao existem avisos bloqueantes.
- `issues`: lista de avisos de revisao.
- `duplicate`: lancamento parecido ou repetido quando encontrado.
- `suggestedType`: tipo sugerido, usado principalmente para Pix/transferencia interna.

Regras:

- A rota normaliza o estado financeiro recebido antes da revisao.
- A rota nao salva dados.
- Duplicidade exata considera mesmo tipo, mesma data e mesmo valor.
- Duplicidade similar considera mesmo valor no mesmo dia entre renda/despesa, ou mesmo tipo e mesmo valor em data proxima.

## Pendencias

- Definir abordagem de API apos escolha da stack.
- Definir formato padrao de erro.
- Definir estrategia de documentacao automatica.
