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
- Conta online com Supabase Auth para sincronizar dados entre celular e desktop quando o deploy estiver configurado.
- Indicador de qualidade dos dados para mostrar se a analise da MAYA esta completa, parcial ou insuficiente.
- Modelo de consentimento inspirado em Open Finance para futuras integracoes, sem conexao bancaria real nesta etapa.

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

- Criar conta ou entrar com e-mail e senha quando Supabase estiver configurado.
- Criar usuarios iniciais pelo Supabase Auth com nome de exibicao e recuperacao administrativa documentada.
- Migrar dados ja existentes no aparelho para a conta online.
- Sincronizar alteracoes confirmadas para ver os mesmos dados em celular e desktop.
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
- Sincronizar anexos originais em storage privado.

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
- Verificar duplicidade por data, valor e tipo antes de salvar renda ou despesa.
- Pedir confirmacao quando o novo lancamento tiver mesma data e mesmo valor de outro ja cadastrado.

Fora de escopo nesta etapa:

- OCR local offline.
- Garantia de leitura perfeita de documentos ilegiveis.
- Criacao automatica sem confirmacao do usuario.
- Conciliacao bancaria automatica.

### Confirmacao de duplicidade

Objetivo: evitar que uma mesma renda, despesa ou conta seja cadastrada duas vezes por engano.

Escopo:

- Comparar novos lancamentos com os registros existentes por data, valor e tipo.
- Comparar contas a pagar por vencimento e valor.
- Exibir os registros possivelmente duplicados antes de salvar.
- Permitir cancelar ou confirmar o salvamento mesmo assim.
- Aplicar a regra em cadastros manuais, anexos lidos pela MAYA, recorrencias e parcelas.

Fora de escopo nesta etapa:

- Remover duplicidades automaticamente.
- Mesclar registros automaticamente.
- Usar banco conectado para conciliacao com transacoes reais.
