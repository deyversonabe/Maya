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

Escopo:

- Dashboard com saldo, receitas, despesas, taxa de economia e patrimonio planejado.
- Cadastro funcional de transacoes.
- Cadastro funcional de metas.
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
- Pagina dedicada de metas com cadastro, atualizacao de progresso e resumo geral.
- Assistente MAYA com analise financeira mensal, comparativos e comportamento seguro quando a analise avancada nao estiver disponivel.
- Orcamentos mensais por categoria, com limite, gasto realizado, saldo restante e alertas.
- Central de Dados e Confianca para visualizar cadastros, qualidade da analise, backup, privacidade e preparo para futuras conexoes financeiras.
- Indicador de qualidade dos dados para mostrar se a analise da MAYA esta completa, parcial ou insuficiente.
- Modelo de consentimento inspirado em Open Finance para futuras integracoes, sem conexao bancaria real nesta etapa.
- Cadastro de pessoas do casal (Pessoas do casal) para identificar quem lancou cada transacao, usado como opcoes dinamicas de "Pessoa" nos formularios.
- Deteccao automatica de duplicidade ao salvar despesa manual, transacao rapida ou importar CSV, bloqueando repeticoes exatas e avisando sobre repeticoes provaveis (ex: mesma despesa lancada pela nota e pelo extrato).
- Categoria "Transferencia interna" e revisao da MAYA que sinaliza quando uma descricao parece Pix/transferencia entre contas proprias, reforcando que esse tipo nao deve contar como receita ou despesa real.
- Camada de validacao local da MAYA (`modules/ai/validation.ts` e `POST /api/maya/validate`) que revisa um lancamento antes da confirmacao, sinalizando duplicidade, campos obrigatorios ausentes e sugestao de transferencia interna.

Fora de escopo nesta etapa:

- Autenticacao real.
- Persistencia em nuvem.
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
- Sincronizar dados entre dispositivos.
