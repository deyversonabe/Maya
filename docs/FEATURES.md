# Features

Este documento registra o mapa funcional do produto. Como o dominio ainda nao foi definido, ele estabelece o processo para criacao de funcionalidades.

## Criterios para nova funcionalidade

Antes de implementar uma feature:

1. Definir problema do usuario.
2. Definir usuario ou papel afetado.
3. Definir fluxo principal.
4. Definir estados alternativos e erros.
5. Avaliar impacto em arquitetura, banco, API, UI, seguranca e IA.
6. Atualizar a documentacao relacionada.
7. Definir criterios de aceite.
8. Implementar e testar.

## Template de especificacao

Cada funcionalidade relevante deve poder ser descrita com:

```text
Nome:
Objetivo:
Usuarios afetados:
Fluxo principal:
Fluxos alternativos:
Dados envolvidos:
Permissoes:
APIs afetadas:
Componentes de UI:
Eventos/logs:
Criterios de aceite:
Riscos:
```

## Funcionalidades-base previstas para SaaS

- Dashboard financeiro do casal.
- Cadastro de receitas e despesas.
- Metas financeiras.
- Planejamento de viagens.
- Resumo de patrimonio.
- Insights inteligentes.
- Cadastro e login.
- Recuperacao de acesso.
- Perfil de usuario.
- Organizacoes ou workspaces.
- Convites e membros.
- Papeis e permissoes.
- Configuracoes.
- Auditoria.
- Billing e planos.
- Painel administrativo.
- Notificacoes.
- Integracoes.
- Recursos de IA quando definidos pelo produto.

## Priorizacao

Prioridade deve considerar:

- Valor para usuario.
- Risco reduzido por implementar cedo.
- Dependencias tecnicas.
- Esforco.
- Impacto na arquitetura.
- Aprendizado gerado.

## Pendencias

- Definir dominio do produto.
- Definir personas.
- Definir funcionalidades do MVP.
- Definir criterios de sucesso do produto.

## Funcionalidades implementadas

### MVP financeiro funcional

Objetivo: transformar a demonstracao visual em um aplicativo utilizavel para organizacao financeira do casal.

### Painel admin

Objetivo: dar controle operacional ao administrador sem expor segredos ao navegador.

Funcionalidades:

- Visualizar usuarios autorizados, papel, status, ultimo acesso e inscricoes push.
- Bloquear ou reativar usuario do workspace.
- Ver saude da sincronizacao online.
- Ver contadores de transacoes, contas, metas, orcamentos e logs.
- Acessar exportacao profissional por periodo.

### Relatorios PDF/Excel

Objetivo: transformar os dados financeiros em documentos de acompanhamento e auditoria.

Funcionalidades:

- Escolher periodo por mes ou intervalo de datas.
- Gerar PDF com resumo, transacoes e contas do periodo.
- Gerar planilha Excel com abas de resumo, transacoes, contas, recorrentes, renda e despesas.
- Exportar JSON do periodo para backup tecnico.

### Push real

Objetivo: permitir alertas mesmo com o app fechado quando o navegador e o sistema operacional permitirem.

Funcionalidades:

- Salvar inscricao push do aparelho do usuario autenticado.
- Service worker recebe notificacoes e abre a tela de contas ao clicar.
- Rotina agendada envia contas vencendo, vencendo hoje, atrasadas e alertas de saude financeira.
- Entregas sao registradas para reduzir duplicidade diaria.

### Memoria financeira da MAYA

Objetivo: permitir perguntas por periodo com base nos dados cadastrados.

Exemplos:

- "Quanto gastei com alimentacao nos ultimos 3 meses?"
- "Quanto ganhei com cabelo nos ultimos 6 meses?"
- "Montar plano de economia para minha meta."

Escopo:

- Dashboard com saldo, receitas, despesas, taxa de economia e patrimonio planejado.
- Cadastro funcional de transacoes.
- Cadastro funcional de metas.
- Metas com saldo ja guardado, data do saldo inicial, novos aportes por data e historico de valores.
- Persistencia versionada dos dados cadastrados.
- Insights locais calculados a partir dos dados.
- Importacao inicial por CSV simples.
- Exportacao dos dados para backup.
- Limpeza dos cadastros.
- Tela inicial com navegacao para paginas funcionais.
- Pagina de despesas com cadastro manual, upload de comprovante e abertura de camera em celular.
- Estrutura inicial para receber comprovantes pelo WhatsApp Cloud API sem n8n.
- Despesas recorrentes geradas automaticamente para meses futuros.
- Despesas parceladas geradas automaticamente em todos os meses da parcela.
- Pagina mensal dedicada com entradas, saidas, investimentos, transferencias, somas e lancamentos discriminados por mes.
- Pagina dedicada de metas com cadastro, historico de saldos, atualizacao de progresso e resumo geral.
- Assistente MAYA com analise financeira mensal, comparativos e comportamento seguro quando a analise avancada nao estiver disponivel.
- Orcamentos mensais por categoria, com limite, gasto realizado, saldo restante e alertas.
- Central de Dados e Confianca para visualizar cadastros, qualidade da analise, backup, privacidade e preparo para futuras conexoes financeiras.
- Conta online com Supabase Auth para sincronizar dados entre celular e desktop quando o deploy estiver configurado.
- Comprovantes financeiros salvos em Supabase Storage privado quando configurado, com visualizacao por URL assinada dentro do app.
- Historico de atividades compartilhado para auditar quem lancou, importou, pagou, alterou ou removeu dados importantes.
- PWA com service worker conservador para instalacao pelo navegador e cache apenas de assets estaticos.
- Notificacoes locais para contas vencendo, vencendo hoje, atrasadas e alertas de saude financeira quando o navegador permitir.
- Indicador de qualidade dos dados para mostrar se a analise da MAYA esta completa, parcial ou insuficiente.
- Modelo de consentimento inspirado em Open Finance para futuras integracoes, sem conexao bancaria real nesta etapa.

Fora de escopo nesta etapa:

- Analise avancada sem configuracao segura do provedor.
- Integracao real com Open Finance ou bancos.
- Pagamentos, assinaturas e multi-tenant.
- Salvamento automatico de despesas vindas do WhatsApp sem revisao humana.
- WhatsApp ativo em producao enquanto a Meta mantiver o numero em revisao.

### WhatsApp para comprovantes

Objetivo: reduzir atrito para cadastrar notas usando o canal que o casal ja utiliza no dia a dia.

Escopo:

- Verificar webhook da Meta.
- Receber eventos de mensagens do WhatsApp.
- Validar assinatura quando o segredo do app estiver configurado.
- Baixar imagem recebida no servidor.
- Enviar imagem para a MAYA criar rascunho revisavel.
- Responder o usuario com resumo curto e orientacao de revisao.

Fora de escopo nesta etapa:

- Salvar despesa automaticamente.
- Associar telefone a casal sem autenticacao.
- Enviar campanhas, mensagens promocionais ou alertas em massa.
- Usar n8n como intermediario.
- Bloquear o lancamento do produto por dependencia de aprovacao da Meta.

### Orcamentos mensais

Objetivo: permitir que o casal planeje o mes antes que as despesas acontecam.

Escopo:

- Criar limite mensal por categoria.
- Comparar automaticamente com despesas do mes.
- Exibir percentual consumido.
- Indicar status saudavel, atencao ou excedido.
- Mostrar saldo restante por categoria.
- Permitir remover orcamentos.
- Alimentar a analise da MAYA.

Fora de escopo nesta etapa:

- Orcamentos compartilhados em nuvem.
- Alertas push.
- Regras automaticas por renda variavel.

### Resumo mensal

Objetivo: permitir que o casal veja cada mes como um extrato organizado.

Escopo:

- Selecionar mes de exibicao.
- Exibir total de entradas, saidas, investimentos e transferencias.
- Exibir saldo final calculado do mes.
- Discriminar lancamentos por tipo, com descricao, categoria, pessoa, data e marcadores de recorrencia ou parcela.
- Permitir remover lancamentos diretamente da visao mensal.

Fora de escopo nesta etapa:

- Extrato bancario automatico.
- Conciliacao com conta bancaria real.
- Edicao detalhada de lancamentos existentes.

### Central de Dados e Confianca

Objetivo: dar ao usuario clareza sobre cadastros, qualidade da analise, privacidade, backup e futuras conexoes.

Escopo:

- Entrar com e-mail e senha criados pelo administrador quando Supabase estiver configurado.
- Criar usuarios iniciais pelo Supabase Auth com nome de exibicao, recuperacao administrativa e vinculo ao workspace compartilhado.
- Migrar dados ja existentes no aparelho para a base compartilhada.
- Sincronizar alteracoes confirmadas para todos os usuarios autorizados e aparelhos.
- Receber atualizacoes de outros aparelhos por Supabase Realtime.
- Bloquear a sessao por inatividade ou fechamento de aba e pedir senha no retorno.
- Exibir contagem de transacoes, metas e orcamentos cadastrados.
- Exibir recursos disponiveis em linguagem de produto, sem nomes de infraestrutura.
- Exibir qualidade da analise da MAYA com itens que faltam cadastrar.
- Permitir exportar backup JSON.
- Permitir limpar cadastros.
- Apresentar preparo para futuras conexoes financeiras com permissao clara e controle do casal.

Fora de escopo nesta etapa:

- Conectar contas bancarias reais.
- Iniciar pagamentos.
- Armazenar consentimentos em servidor.
- Sincronizar anexos originais sem otimizacao em storage privado.

### Contas a pagar e alertas

Objetivo: permitir que o casal acompanhe boletos, Pix copia e cola, vencimentos, anexos e status de pagamento sem depender de banco conectado.

Escopo:

- Cadastrar contas manualmente.
- Anexar imagem de conta, boleto, Pix, comprovante ou documento financeiro.
- Usar a MAYA para ler titulo, descricao, valor, categoria, data do documento, data de vencimento, codigo de pagamento e tipo de documento.
- Exigir revisao humana antes de salvar qualquer dado extraido por IA.
- Exigir preenchimento manual do titulo quando a imagem nao trouxer uma identificacao confiavel.
- Organizar contas pelo mes de vencimento.
- Registrar boleto, Pix copia e cola, categoria, valor, recorrencia, parcelas, status, anexo e observacoes.
- Copiar codigo Pix/boleto para a area de transferencia.
- Marcar conta como paga.
- Mostrar status pendente, pago ou atrasado.
- Calcular alertas 48h antes do vencimento, alerta de vencimento no dia e resumo de contas atrasadas.
- Exibir lista de contas vencendo, resumo do dia e resumo do mes.

Fora de escopo nesta etapa:

- Pagar boletos ou Pix dentro do app.
- Agendar pagamento bancario real.
- Cobrar tarifa, intermediar dinheiro ou iniciar transacao financeira.
- Enviar alertas por WhatsApp enquanto a Meta nao liberar o numero de producao.
- Garantir notificacao em segundo plano com o navegador fechado sem backend, push ou permissao nativa.

### Leitura de anexos financeiros

Objetivo: transformar imagens enviadas pelo usuario em rascunhos revisaveis de despesa, renda ou conta a pagar.

Escopo:

- Enviar imagem para rota server-side da MAYA.
- Nunca enviar chave OpenAI ao frontend.
- Retornar rascunho com confianca e campos faltantes.
- Exibir um painel de dados do anexo com nome/titulo, descricao, valor, data, categoria, pessoa e observacoes editaveis antes do salvamento.
- Permitir abrir o anexo original para conferencia visual durante a revisao.
- Ler descricoes e itens de notas, comprovantes e extratos bancarios quando estiverem legiveis.
- Usar campos vazios quando a imagem nao sustentar uma informacao.
- Bloquear salvamento quando titulo, valor ou data obrigatoria estiverem ausentes.
- Salvar o anexo confirmado junto do lancamento ou da conta correspondente.
- Verificar suspeita de duplicidade por data, valor e tipo antes de salvar renda ou despesa.
- Alertar tambem quando houver valor igual no mesmo dia mesmo que a IA tenha classificado como tipo diferente.
- Pedir aprovacao explicita para computar ou excluir quando o novo lancamento tiver valor repetido em data igual ou proxima.

Fora de escopo nesta etapa:

- OCR local offline.
- Garantia de leitura perfeita de documentos ilegiveis.
- Criacao automatica sem confirmacao do usuario.
- Conciliacao bancaria automatica.

### Confirmacao de duplicidade

Objetivo: evitar que uma mesma renda, despesa ou conta seja cadastrada duas vezes por engano.

Escopo:

- Comparar novos lancamentos com os registros existentes por data, valor e tipo.
- Considerar suspeita quando houver mesmo valor no mesmo dia, mesmo que o tipo renda/despesa esteja diferente.
- Considerar suspeita quando houver mesmo valor e mesmo tipo em data proxima.
- Comparar contas a pagar por vencimento e valor.
- Exibir os registros possivelmente duplicados antes de salvar.
- Permitir excluir o novo lancamento ou computar mesmo assim.
- Aplicar a regra em cadastros manuais, anexos lidos pela MAYA, recorrencias e parcelas.

Fora de escopo nesta etapa:

- Remover duplicidades automaticamente.
- Mesclar registros automaticamente.
- Usar banco conectado para conciliacao com transacoes reais.

### MAYA especialista em calculos e negociacao

Objetivo: permitir que o chat da MAYA responda com calculos financeiros praticos e orientacao educativa para decisoes de credito.

Escopo:

- Calcular juros simples, juros compostos, parcela fixa estimada e custo total quando o usuario informar valor, taxa e prazo.
- Avaliar propostas de emprestimo ou financiamento com valor liberado, parcelas, prazo, custo total aproximado e peso na renda cadastrada.
- Orientar negociacao de contas atrasadas com foco em demonstrativo da divida, desconto de juros/multa, proposta por escrito e parcela sustentavel.
- Usar uma camada local deterministica para calculos antes da chamada de IA externa.
- Manter o placar de saude financeira atual ao responder perguntas de calculo.
- Basear orientacoes em conceitos brasileiros como CET, Banco Central, CDC, Lei do Superendividamento, Procon-SP e Consumidor.gov.br, sem inventar artigos, taxas ou regras especificas.

Fora de escopo nesta etapa:

- Prestar consultoria financeira regulada, assessoria juridica ou promessa de aprovacao de credito.
- Buscar taxas oficiais em tempo real dentro do chat.
- Fazer pagamento, contratar emprestimo, negociar diretamente com credoras ou enviar proposta automatica.

### Extrato, Pix e analiticos por periodo

Objetivo: permitir que o usuario envie imagem de extrato bancario, revise a separacao entre renda e despesa e acompanhe padroes por periodo.

Escopo:

- Anexar imagem de extrato bancario na tela de despesas.
- Usar a MAYA para separar linhas em renda e despesa, sem inventar linhas ilegiveis.
- Ignorar saldo, total, cabecalho e linhas que nao sejam transacoes financeiras reais.
- Revisar cada linha antes de importar, com tipo, descricao, valor, data, categoria, pessoa, forma de pagamento e destinatario Pix.
- Alertar quando houver valor repetido no mesmo dia dentro do extrato ou contra dados ja salvos.
- Exigir destinatario quando uma despesa for marcada como Pix.
- Diferenciar categorias de renda: Salario, Sobrancelha, Henna, Cabelo, Jogos e Outros.
- Abrir campo opcional de descricao quando renda ou despesa estiver em Outros.
- Guardar itens/linhas lidos no anexo dentro da transacao ou conta confirmada.
- Permitir consultar os itens do anexo dentro do app, sem baixar o arquivo novamente.
- Exibir grafico mensal com duas linhas: renda e despesa.
- Somar pagamentos recorrentes, Pix nominais, boletos e contas por periodo entre dias ou meses.
- Somar renda por filtro de categoria e mostrar quantidade de transacoes do periodo.
- Exibir alertas de saude financeira quando renda ou despesa fugir da rotina recente.

Fora de escopo nesta etapa:

- Leitura de PDF bancario nativo sem converter para imagem.
- Conexao bancaria real ou conciliacao automatica com Open Finance.
- Pagamento, agendamento ou iniciacao de Pix/boleto dentro do app.
- Notificacao push nativa com navegador fechado.
