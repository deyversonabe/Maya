# Design System

Este documento define a base visual e de experiencia do produto. Ele deve ser atualizado sempre que novos componentes, padroes ou decisoes visuais forem introduzidos.

## Filosofia visual

O produto deve transmitir confianca, clareza e eficiencia. Como a plataforma pode evoluir para SaaS, a interface deve ser profissional, consistente e adequada para uso recorrente.

## Referencia visual inicial

Asset exploratorio:

- `docs/assets/juntos-initial-visual-concept.png`
- `docs/assets/juntos-initial-visual-concept-moss-bronze.png`
- `public/brand/juntos-maya-logo.png`

Estas imagens sao referencias iniciais para direcao visual, nao especificacoes finais. Elas sugerem uma interface SaaS operacional com navegacao lateral, dashboard modular, areas para documentacao, arquitetura, roadmap, seguranca, banco de dados, API e assistente de IA.

Direcao visual preferencial atual:

- Fundo principal em verde-musgo escuro.
- Titulos e marca em bronze ou terracota.
- Superficies internas em verdes escuros dessaturados, com contraste suficiente para leitura.
- Textos secundarios em tons claros e quentes.
- Acentos controlados em bronze, terracota, dourado suave e teal discreto.

Decisoes visuais sugeridas pela referencia:

- Interface profissional e orientada a produtividade.
- Base escura em verde-musgo com acentos quentes.
- Organizacao em paineis escaneaveis para uso recorrente.
- Presenca de IA como apoio contextual, sem dominar a experiencia.

Antes de transformar essa referencia em implementacao, validar identidade visual, tokens, componentes e acessibilidade.

## Logo

A logo oficial inicial do sistema esta em:

- `public/brand/juntos-maya-logo.png`

Regras de uso:

- A logo deve aparecer no cabecalho principal.
- A logo sempre deve funcionar como link/botao para voltar ao inicio (`/`).
- A interacao deve ter `aria-label` claro para acessibilidade.
- O asset oficial atual ja possui transparencia e deve ser renderizado com `object-contain`.
- Em fundos escuros, usar contraste e tamanho controlado sem criar fundo opaco artificial para a logo.
- Nao distorcer proporcao da imagem.
- Caso o asset seja substituido no futuro, validar transparencia antes do deploy.

## Principios de UX

- Fluxos simples para tarefas frequentes.
- Informacao organizada por prioridade.
- Acoes principais sempre claras.
- Feedback visivel para loading, sucesso, erro e vazio.
- Formularios objetivos, com validacao proxima ao campo.
- Responsividade real em desktop, tablet e mobile.
- Acessibilidade desde a criacao dos componentes.
- Campos `select` devem manter contraste legivel tambem no menu nativo de opcoes.
- Rascunhos criados por anexo devem exibir painel de revisao editavel com campos compactos, link de conferencia do anexo original e aviso de campos faltantes.
- Painel de revisao de anexo deve usar superficie interna discreta, sem criar card aninhado, para manter clareza dentro dos formularios.

## Componentes

Todo componente reutilizavel deve definir:

- Proposito.
- Variantes.
- Estados.
- Regras de acessibilidade.
- Comportamento responsivo.
- Exemplos de uso quando necessario.

Componentes basicos previstos:

- Button.
- Input.
- Textarea.
- Select.
- Checkbox.
- Toggle.
- Modal/Dialog.
- Toast/Alert.
- Table/DataGrid.
- Tabs.
- Sidebar/Navigation.
- Card para itens repetidos.
- EmptyState.
- LoadingState.
- ErrorState.

## Padroes de layout

- Evitar excesso de cards decorativos.
- Usar espacos consistentes.
- Manter densidade adequada para produto operacional.
- Garantir que textos nao estourem seus containers.
- Usar hierarquia tipografica proporcional ao contexto.
- Em telas de ate 360px, reduzir padding de paineis e permitir quebra segura de texto para evitar distorcao ou rolagem horizontal.

## Acessibilidade

Requisitos minimos:

- Contraste adequado.
- Navegacao por teclado.
- Estados de foco visiveis.
- Labels em campos.
- Uso correto de semantica.
- Mensagens de erro associadas aos campos.

## Tokens de design

Tokens devem ser definidos quando a stack visual for escolhida.

Categorias previstas:

- Cores.
- Tipografia.
- Espacamento.
- Raios de borda.
- Sombras.
- Z-index.
- Breakpoints.
- Duracao de animacoes.

Tokens cromaticos iniciais sugeridos:

- `color-background-primary`: verde-musgo escuro, exemplo `#1F3026`.
- `color-background-secondary`: verde profundo dessaturado, exemplo `#243728`.
- `color-surface-primary`: verde escuro elevado, exemplo `#16291F`.
- `color-surface-secondary`: verde musgo transluzido, exemplo `#203B2B`.
- `color-title-primary`: bronze, exemplo `#B87945`.
- `color-title-secondary`: terracota, exemplo `#C46A43`.
- `color-text-primary`: off-white quente.
- `color-accent-muted`: teal discreto para estados informativos.

## Primeira tela estatica

A primeira tela web deve seguir a referencia `juntos-initial-visual-concept-moss-bronze.png`.

Regras:

- Fundo geral em verde-musgo escuro.
- Marca e titulos em bronze/terracota.
- Cards com contraste suficiente e bordas discretas.
- Interface densa, mas legivel.
- Evitar visual promocional; a tela deve parecer produto utilizavel.
- Garantir responsividade para desktop e mobile.

## UI v2

A interface deve evoluir para uma experiencia premium, emocional e funcional.

Diretrizes da UI v2:

- Home com mensagem humana, logo em destaque, resumo financeiro e acoes principais.
- Navegacao desktop compacta no topo e navegacao mobile fixa inferior.
- Dashboard com "Resumo do Casal" como primeiro bloco de leitura.
- Cards com iluminacao sutil em bronze/ciano, sem exagero visual.
- Iluminacao deve priorizar linhas, bordas, sombras e gradientes lineares; evitar manchas circulares decorativas.
- Motion design elegante: entrada suave, hover discreto e linhas de LED controladas.
- MAYA deve parecer assistente presente, com avatar/logo, status de analise e respostas em blocos claros.
- Estados vazios devem orientar o usuario para a proxima acao.
- Logo oficial deve usar o asset com transparencia em `public/brand/juntos-maya-logo.png`.

Componentes visuais preferenciais:

- `AppShell`: cabecalho e navegacao responsiva.
- `BottomNav`: navegacao mobile fixa.
- `HeroPanel`: bloco premium de entrada.
- `CoupleSummary`: resumo de saude financeira do casal.
- `VisualMetric`: card de indicador com movimento e destaque.
- `InsightPanel`: recomendacoes da MAYA.
- `MonthlyLedger`: visao mensal com resumo, totais e lancamentos discriminados.

## Formularios e seletores

- `select`, `option` e itens selecionados devem usar fundo verde-musgo escuro e texto claro.
- A opcao selecionada deve ter contraste com bronze ou terracota sem esconder o texto.
- Estados de foco devem manter borda bronze e anel visivel.
- O menu nativo pode variar por navegador, por isso as cores globais de `option` devem ser definidas em CSS.
- A navegacao mobile deve priorizar legibilidade e nao pode criar rolagem horizontal da pagina.

## Linguagem de interface

- A interface deve falar com o usuario em linguagem de produto, nunca como painel tecnico.
- Evitar nomes como chaves de API, provedores, banco, ambiente, servidor, schema, modo local ou status interno em textos visiveis.
- Preferir termos claros: `MAYA ativa`, `backup disponivel`, `cadastros`, `privacidade`, `conexoes futuras`, `recursos disponiveis`.
- Mensagens de erro devem orientar a proxima acao sem revelar detalhes internos.

## Pendencias

- Definir identidade visual.
- Definir paleta.
- Definir escala tipografica.
- Definir biblioteca ou abordagem de componentes.
