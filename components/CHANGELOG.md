# Changelog

Todas as mudancas relevantes do projeto devem ser registradas neste arquivo.

O formato deve seguir uma adaptacao de Keep a Changelog, com secoes por data e categorias como Added, Changed, Deprecated, Removed, Fixed e Security quando aplicavel.

## [Unreleased]

### Added

- Estrutura inicial de documentacao viva em `docs/`.
- Documento principal `PROJECT_RULES.md` definido como fonte de verdade do projeto.
- Diretrizes iniciais para arquitetura, banco de dados, API, design system, IA, seguranca, contribuicao e roadmap.
- Imagem conceitual inicial em `docs/assets/juntos-initial-visual-concept.png`.
- Variacao visual com fundo verde-musgo escuro e titulos em bronze/terracota em `docs/assets/juntos-initial-visual-concept-moss-bronze.png`.
- Primeira tela web estatica implementada para resolver acesso inicial em deploy Vercel.
- MVP financeiro funcional implementado com Next.js, TypeScript, TailwindCSS, Framer Motion, Prisma preparado e persistencia local versionada.
- Funcionalidades de transacoes, metas, indicadores, insights locais, importacao CSV, exportacao JSON e limpeza de dados locais.
- Dados ficticios iniciais removidos; o app agora inicia sem informacoes financeiras inventadas.
- Assistente financeiro MAYA implementada como modulo real com analise mensal, comparativos, leitura de comprovantes e fallback local sem chave OpenAI.
- Telas separadas implementadas para Inicio, Dashboard, Despesas, Metas e MAYA.
- Rotas server-side implementadas para `OPENAI_API_KEY`, `OPENAI_MODEL` e `OPENAI_VISION_MODEL`.
- Despesas manuais, por foto/camera, recorrentes e parceladas implementadas com divisao por meses.
- Logo Juntos Maya adicionada em `public/brand/juntos-maya-logo.png` e configurada como botao/link de retorno ao inicio.
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
- Rotas da MAYA normalizam estado financeiro recebido e limitam tamanho de imagem enviada para leitura de comprovante.
- Botao em modo link passa a aplicar area clicavel completa no elemento de navegacao.
- Leitura de comprovantes reforcada com timeout, modo JSON, detalhe alto para OCR, modelo de visao recomendado e mensagens de falha mais especificas sem termos tecnicos de infraestrutura.

## [0.0.1] - 2026-07-09

### Added

- Inicializacao documental do projeto.
- Base para evolucao futura como plataforma SaaS.
