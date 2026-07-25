# Changelog

Todas as mudancas relevantes do projeto devem ser registradas neste arquivo.

O formato deve seguir uma adaptacao de Keep a Changelog, com secoes por data e categorias como Added, Changed, Deprecated, Removed, Fixed e Security quando aplicavel.

## [Unreleased]

### Added

- Estrutura inicial de documentacao viva em `docs/`.
- Documento principal `PROJECT_RULES.md` definido como fonte de verdade do projeto.
- Diretrizes iniciais para arquitetura, banco de dados, API, design system, IA, seguranca, contribuicao e roadmap.
- Imagem conceitual inicial em `docs/assets/maya-initial-visual-concept.png`.
- Variacao visual com fundo verde-musgo escuro e titulos em bronze/terracota em `docs/assets/maya-initial-visual-concept-moss-bronze.png`.
- Primeira tela web estatica implementada para resolver acesso inicial em deploy Vercel.
- MVP financeiro funcional implementado com Next.js, TypeScript, TailwindCSS, Framer Motion, Prisma preparado e persistencia local versionada.
- Funcionalidades de transacoes, metas, indicadores, insights locais, importacao CSV, exportacao JSON e limpeza de dados locais.
- Dados ficticios iniciais removidos; o app agora inicia sem informacoes financeiras inventadas.
- Assistente financeiro MAYA implementada como modulo real com analise mensal, comparativos, leitura de comprovantes e fallback local sem chave OpenAI.
- Telas separadas implementadas para Inicio, Dashboard, Despesas, Metas e MAYA.
- Rotas server-side implementadas para `OPENAI_API_KEY`, `OPENAI_MODEL` e `OPENAI_VISION_MODEL`.
- Despesas manuais, por foto/camera, recorrentes e parceladas implementadas com divisao por meses.
- Logo Maya adicionada em `public/brand/maya-logo.png` e configurada como botao/link de retorno ao inicio.
- Guia de deploy adicionado em `docs/DEPLOYMENT.md` para evitar upload em pastas incorretas no GitHub.
- Ferramenta de orcamentos mensais por categoria implementada para controle preventivo da saude financeira.
- Migracao local para `schemaVersion = 2`, preservando dados antigos e adicionando `budgets`.
- Redesign UI v2 planejado com home premium, navegacao mobile fixa, resumo do casal, melhor hierarquia visual e motion design sutil.
- Redesign UI v2 implementado com home premium, navegacao mobile fixa, paineis LED, resumo do casal e refinamento visual da MAYA.
- Logo oficial substituida por asset transparente e aplicada com `object-contain` para evitar recorte ou fundo aparente.
- Modelo OpenAI padrao atualizado para `gpt-5-mini`, mantendo configuracao por `OPENAI_MODEL` e `OPENAI_VISION_MODEL`.
- Pagina dedicada de Metas implementada em `/goals`, mantendo navegacao principal e logo de retorno ao inicio.
- Central de Dados e Confianca implementada em `/data`, inspirada em boas praticas de consentimento e controle de dados do Open Finance.
- Indicador de qualidade dos dados da MAYA implementado para sinalizar analise insuficiente, parcial ou consistente.
- Rota segura `GET /api/system/status` adicionada para expor capacidades configuradas sem revelar segredos.
- Pagina `Meses` implementada para visualizar entradas, saidas, investimentos, transferencias e lancamentos discriminados por mes.
- Estrutura inicial de WhatsApp Cloud API direto adicionada para receber comprovantes sem n8n.
- Guia `WHATSAPP_SETUP.md` adicionado com variaveis, configuracao na Meta e passo a passo de deploy.
- Paginas publicas `/privacy`, `/terms` e `/data-deletion` adicionadas para configuracao do app na Meta.
- Estado atual da configuracao do numero WhatsApp salvo em `docs/WHATSAPP_CONFIGURATION_STATUS.md`.
- Flag `WHATSAPP_ENABLED` adicionada para publicar o produto sem depender da aprovacao da Meta.
- Modulo `Contas` adicionado para contas a pagar, boletos, Pix copia e cola, vencimentos, anexos, status, recorrencias, parcelas e alertas.
- Leitura de anexos financeiros ampliada para rascunhos de despesa, renda ou conta a pagar, sempre com revisao humana antes de salvar.
- Migracao local para `schemaVersion = 3`, preservando dados existentes e adicionando `bills`.
- Resumos de contas vencendo, resumo do dia e resumo do mes adicionados ao fluxo financeiro.
- Confirmacao de duplicidade adicionada para renda, despesa e contas quando data/vencimento e valor coincidirem.
- Exibicao de itens lidos pela MAYA em notas, comprovantes e extratos antes da confirmacao do usuario.
- Headers HTTP de seguranca adicionados globalmente em `next.config.mjs`.
- Webhook WhatsApp passa a ignorar eventos POST quando `WHATSAPP_ENABLED` nao estiver ativo.
- Manifesto PWA mantido para instalacao como app pelo navegador com `display: standalone`.
- Rota `POST /api/maya/validate` corrigida e integrada aos tipos atuais para revisar duplicidade e transferencia interna sem quebrar o build.
- Preparacao de anexos no navegador adicionada para reduzir imagens grandes e converter comprovantes para JPEG antes da leitura da MAYA.
- Logs seguros `maya_receipt_read_failed` adicionados para diagnosticar falhas de leitura de comprovantes sem expor segredos ou imagens.
- Rota `/api/maya/receipt` configurada com `maxDuration = 10` e timeout interno de 7,5s para evitar 503/504 por encerramento da funcao na Vercel.
- Painel editavel de dados do anexo adicionado para revisar nome/titulo, descricao, valor, data, categoria, pessoa e observacoes antes de salvar.
- Sincronizacao online com Supabase Auth adicionada para acessar os mesmos dados no celular e no desktop.
- Migracao SQL `supabase/migrations/20260719_finance_states.sql` adicionada com RLS por usuario.
- Script administrativo e guia `AUTH_USERS_SETUP.md` adicionados para criar usuarios iniciais no Supabase Auth sem versionar senhas.
- Workspace financeiro compartilhado adicionado para usuarios autorizados verem a mesma base em todos os aparelhos.
- Supabase Realtime adicionado ao estado financeiro compartilhado para propagar alteracoes entre aparelhos.
- Bloqueio de sessao por inatividade e fechamento de aba adicionado para exigir senha novamente.
- Autenticacao obrigatoria aplicada no layout raiz com excecao apenas para paginas legais publicas.
- Comprovantes otimizados passam a ser preservados na sincronizacao em nuvem.
- Rota `POST /api/maya/statement` adicionada para leitura de imagem de extrato bancario com separacao entre renda e despesa.
- Revisao editavel de extratos adicionada na tela de Despesas antes da importacao.
- Despesas Pix agora exigem destinatario antes do salvamento.
- Categorias de renda separadas em Salario, Sobrancelha, Henna, Cabelo, Jogos e Outros.
- Campo opcional de descricao ativado quando renda, despesa ou conta usa categoria Outros.
- Itens de nota e linhas de extrato passam a ser salvos no lancamento/conta e consultados dentro do app.
- Aba Meses ganhou grafico de linha com renda e despesa, filtros entre dias/meses e somas por periodo.
- Somatorio de Pix nominal, boleto, conta, recorrencia e parcela adicionado por periodo filtrado.
- Alertas locais de saude financeira adicionados para avisar renda ou despesa fora da rotina recente.
- Ferramentas locais da MAYA adicionadas para calculo de juros, avaliacao de proposta de emprestimo/financiamento e roteiro de negociacao de contas atrasadas.
- Sugestoes de chat adicionadas para juros, emprestimos e contas em atraso.
- Notificacao de duplicidade reforcada para exigir decisao entre excluir o novo registro ou computar mesmo assim.
- Metas agora permitem registrar saldo guardado com data, adicionar novos aportes por meta e consultar historico de saldos.
- Marca textual do produto consolidada como Maya em metadados, manifesto, interface e documentacao.
- Supabase Storage privado adicionado para comprovantes, notas, boletos, Pix e extratos anexados, com fallback local quando o bucket ainda nao estiver configurado.
- Links assinados de anexo adicionados para visualizar comprovantes em celular e desktop sem tornar arquivos publicos.
- Historico de atividades adicionado para registrar usuario, acao, entidade e horario de lancamentos, importacoes, metas, orcamentos e contas.
- Leitura de notas reforcada para DANFE NF-e, DANFE NFC-e e cupom fiscal, com chave de acesso, CNPJ, numero, serie, protocolo, totais e itens fiscais quando legiveis.
- Dados fiscais lidos pela MAYA passam a ser preservados em `fiscalDocument` e exibidos na revisao do anexo antes de salvar.
- Valores financeiros deixam de ser exibidos arredondados para reais inteiros; moeda preserva centavos e casas decimais relevantes.
- Parser financeiro unificado adicionado para entradas manuais e CSV, aceitando formatos brasileiros como `1.234,56` sem perder o valor real.
- Editor de linhas de extrato corrigido para nao remontar o campo a cada caractere digitado, preservando foco/cursor durante a edicao.
- Service worker conservador adicionado para instalacao PWA e cache apenas de assets estaticos, sem cachear APIs financeiras.
- Painel de notificacoes locais adicionado para alertas de contas vencendo, vencendo hoje, atrasadas e saude financeira quando o navegador permitir.
- Tema visual neon/LED adicionado com scanlines, brilho controlado, cards mais vivos, botoes com destaque e movimento sutil.
- Valores financeiros negativos agora usam vermelho de alerta em metricas, saldos, resumos, metas, despesas, orcamentos e itens lidos de anexos.
- Painel Admin adicionado em `/admin` para usuarios, bloqueio/reativacao, ultimo acesso, saude da sincronizacao e volume de dados.
- Exportacao profissional adicionada com PDF, Excel e JSON por mes ou intervalo de datas.
- Push real estruturado com inscricao do aparelho, service worker, tabela de inscricoes, rotina agendada e deduplicacao diaria de alertas.
- Base relacional Supabase preparada para transacoes, contas, metas e anexos, mantendo JSONB compartilhado como fonte operacional do MVP.
- MAYA ganhou memoria financeira por periodo e plano automatico de economia para metas cadastradas.
- Atalho mobile "Nova despesa" adicionado acima da navegacao inferior.
- Login ganhou acao `Esqueci minha senha`, fluxo de nova senha por link Supabase e botao para mostrar/ocultar senha.
- Migration `20260725_admin_unique_and_safe_workspace_state.sql` adicionada para admin unico por e-mail e salvamento com lock de linha no Supabase.
- Merge seguro da RPC passa a preservar campos de anexo e itens lidos quando duas sessoes salvam versoes diferentes do mesmo registro.

### Fixed

- Bloco duplicado de marca/MAYA removido da area principal da home.
- Contraste dos menus de selecao corrigido para opcoes ficarem legiveis ao abrir o seletor.
- Textos visiveis da interface ajustados para remover termos de bastidor, como chaves, provedores, banco, ambiente, modo tecnico e status interno.
- Contratos da MAYA e da rota de status simplificados para nao devolver modo tecnico ou nomes de infraestrutura ao frontend.
- Responsividade em telas estreitas reforcada com padding reduzido, quebra segura de texto e headers flexiveis.
- MAYA local agora declara dados insuficientes quando nao existem transacoes reais cadastradas.
- Fallback de leitura de comprovante nao infere descricao, categoria ou valor quando a OpenAI nao esta configurada ou a leitura falha.
- Migracao local remove dados demonstrativos antigos armazenados no navegador para `schemaVersion` 1 e 2.
- Separadores visuais Unicode removidos de componentes para evitar caracteres corrompidos em ambientes Windows/GitHub.
- Fundo global ajustado para iluminacao linear/LED, sem gradientes circulares decorativos.
- Design system atualizado com paleta musgo, bronze, terracota, cyan/verde/rosa neon e criterio visual obrigatorio para numeros negativos.
- `AuthGate` passa a reconhecer usuario bloqueado e registrar ultimo acesso por funcao segura no Supabase.
- Rotas da MAYA normalizam estado financeiro recebido e limitam tamanho de imagem enviada para leitura de comprovante.
- Botao em modo link passa a aplicar area clicavel completa no elemento de navegacao.
- Leitura de comprovantes reforcada com timeout, modo JSON, detalhe alto para OCR, modelo de visao recomendado e mensagens de falha mais especificas sem termos tecnicos de infraestrutura.
- Corrigido `AuthGate` que existia no projeto, mas nao estava aplicado ao layout, deixando o app abrir sem login.
- Cadastro publico removido da interface de conta e bloqueado na funcao interna de sincronizacao.
- Caixa rapida da MAYA na pagina inicial agora usa fallback local quando a rota de IA falha ou retorna resposta invalida.
- Documentacao duplicada removida de `components/`; conteudo relevante consolidado em `docs/`, mantendo componentes apenas como arquivos de UI.
- Link de recuperacao do Supabase passa a abrir tela de definicao de nova senha em vez de voltar para o bloqueio de login.
- Autorizacao pos-login passa a filtrar `finance_workspace_members` por `workspace_id` e `user_id`, evitando logout indevido quando Deyveron e Tom estao no mesmo workspace.
- Pasta duplicada `supabase/migrations/migrations` removida, mantendo migrations somente em `supabase/migrations/`.
- Login deixa de reaproveitar trava local antiga depois de uma autenticacao bem-sucedida, reduzindo bloqueios intermitentes por historico do navegador.
- Abas `Dados` e `Admin`, painel de usuarios e rotas administrativas passam a ser exclusivas de `deyversonsilvaf@gmail.com`.
- Salvamento do estado financeiro compartilhado passa a usar RPC com `SELECT ... FOR UPDATE`, reduzindo risco de perda silenciosa de lancamentos concorrentes.
- Merge em tempo real do cliente passa a reenviar a mescla quando este aparelho possui alteracoes locais mais novas, evitando que dados fiquem presos em uma sessao.
- `package-lock.json` atualizado por reinstalacao controlada, elevando resolucoes automaticas seguras.
- Dependencia `xlsx` removida; exportacao Excel passa a gerar planilha XML `.xls` compativel com Excel sem biblioteca vulneravel.
- Dependencia transitoria `sharp` fixada em versao corrigida via `overrides`, removendo a copia vulneravel herdada do Next sem downgrade forcado.
- Planilha XML `.xls` deixa de aplicar formato monetario generico a todo numero, evitando que colunas de quantidade sejam exibidas como valores em dinheiro.
- Botao `Sair` adicionado na barra principal para usuarios comuns manterem controle da sessao mesmo sem acesso a `Dados`.
- Merge local de registros passa a preservar `attachmentImageName`, `receiptImageName` e `documentItems`, alem dos dados tecnicos do anexo.

## [0.0.1] - 2026-07-09

### Added

- Inicializacao documental do projeto.
- Base para evolucao futura como plataforma SaaS.
