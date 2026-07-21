# PROJECT_RULES

Este documento e a fonte principal de verdade do projeto. Toda decisao tecnica, funcional ou visual deve ser comparada com estas regras antes de ser implementada.

## 1. Filosofia do projeto

O projeto deve nascer como uma plataforma profissional, preparada para evoluir para um SaaS sem reestruturacoes profundas.

Principios obrigatorios:

- Qualidade acima de velocidade.
- Modularidade acima de atalhos.
- Baixo acoplamento e alta coesao.
- Documentacao viva como parte da implementacao.
- Seguranca, privacidade e observabilidade desde o inicio.
- Evolucao incremental, evitando reescritas grandes.
- Decisoes explicitas, registradas e revisaveis.

Nenhuma funcionalidade deve ser implementada apenas para "funcionar agora" se isso comprometer manutencao, seguranca, escalabilidade ou clareza futura.

## 2. Fluxo obrigatorio antes de implementar

Antes de escrever codigo para qualquer nova funcionalidade, o Codex deve:

1. Analisar o impacto tecnico, funcional, visual, de dados, seguranca e operacao.
2. Verificar se existe documentacao relacionada em `docs/`.
3. Atualizar a documentacao afetada antes da implementacao quando a mudanca alterar arquitetura, banco, API, design, fluxos, seguranca, IA ou comportamento de produto.
4. Implementar a funcionalidade seguindo este documento.
5. Validar a mudanca com testes, verificacoes manuais ou ambos.
6. Gerar um Implementation Report ao final.

Se houver mais de uma solucao viavel, o Codex deve apresentar alternativas, justificar a recomendacao e implementar a opcao mais robusta.

## 3. Padroes de arquitetura

A arquitetura padrao deve ser modular e evolutiva.

Diretrizes:

- Preferir um modular monolith bem separado antes de distribuir servicos.
- Separar responsabilidades por dominio, nao apenas por tipo tecnico.
- Manter regras de negocio fora de controllers, rotas, componentes visuais e adaptadores externos.
- Isolar integracoes externas atras de interfaces ou servicos de infraestrutura.
- Evitar dependencias circulares entre modulos.
- Toda regra de negocio relevante deve ser testavel sem depender de UI, banco real ou servicos externos.
- Preparar desde cedo conceitos de SaaS: organizacoes, usuarios, papeis, permissoes, auditoria, plano/assinatura e limites de uso.

Camadas recomendadas:

- Interface: UI, controllers, rotas, handlers ou endpoints.
- Aplicacao: casos de uso, orquestracao e validacao de fluxo.
- Dominio: entidades, politicas, regras e invariantes.
- Infraestrutura: banco, filas, cache, storage, email, provedores de IA e APIs externas.
- Observabilidade: logs, metricas, traces e auditoria.

## 4. Organizacao de pastas

A estrutura final dependera da stack escolhida, mas deve seguir estes principios:

- `docs/`: documentacao viva e obrigatoria.
- `src/` ou equivalente: codigo de aplicacao.
- `tests/` ou testes proximos ao codigo: testes automatizados.
- `scripts/`: automacoes operacionais e utilitarias.
- `config/`: configuracoes nao secretas.
- `public/` ou `assets/`: arquivos estaticos quando aplicavel.

Dentro de `src/`, preferir organizacao por dominio:

```text
src/
  modules/
    billing/
    users/
    organizations/
    ai/
  shared/
    errors/
    logging/
    validation/
    database/
    ui/
```

Pastas compartilhadas so devem conter codigo realmente generico. Se algo pertence a um dominio, deve ficar no modulo daquele dominio.

## 5. Regras de codigo

- Codigo deve ser claro, previsivel e facil de testar.
- Evitar funcoes longas, objetos globais mutaveis e logica duplicada.
- Preferir validacao explicita de entrada e saida.
- Preferir tipos, schemas ou contratos quando a stack permitir.
- Erros devem ser tratados de forma intencional, com mensagens seguras para usuarios e detalhes tecnicos apenas em logs.
- Nao misturar regras de negocio com detalhes de framework.
- Nao hard-codear credenciais, URLs sensiveis, tokens, segredos ou configuracoes por ambiente.
- Comentarios devem explicar decisoes ou blocos complexos, nao repetir o que o codigo ja diz.
- Toda dependencia nova precisa de justificativa tecnica.

## 6. Convencoes de nomenclatura

As convencoes exatas acompanham a linguagem escolhida, mas estas regras sao obrigatorias:

- Nomes devem expressar intencao de negocio.
- Evitar abreviacoes obscuras.
- Usar nomes consistentes para conceitos centrais.
- Entidades de dominio devem usar substantivos claros.
- Casos de uso devem usar verbo + objeto, como `CreateOrganization` ou `GenerateReport`.
- APIs devem usar recursos no plural, como `/users`, `/organizations` e `/projects`.
- Campos booleanos devem indicar estado, como `isActive`, `hasAccess`, `canEdit`.
- Datas devem explicitar sentido, como `createdAt`, `updatedAt`, `deletedAt`, `expiresAt`.

## 7. Padroes de UI/UX

O produto deve ter aparencia profissional, consistente e orientada a produtividade.

Diretrizes:

- Priorizar clareza, hierarquia visual e eficiencia de fluxo.
- Evitar interfaces decorativas que prejudiquem leitura ou uso recorrente.
- Componentes devem ter estados de loading, empty, erro, sucesso e disabled quando aplicavel.
- Formularios devem ter validacao visivel, mensagens claras e preservacao de dados quando possivel.
- Acessibilidade deve ser considerada desde o inicio: contraste, foco, navegacao por teclado, labels e semantica.
- Layouts devem ser responsivos e nao devem quebrar em telas pequenas.
- A identidade visual da Maya pode usar efeitos neon/LED, mas sempre com movimento sutil, contraste alto e respeito a `prefers-reduced-motion`.
- Valores financeiros negativos, saldos estourados ou correcoes abaixo de zero devem usar vermelho de alerta em qualquer tela.
- Efeitos visuais nao podem esconder estados importantes, dificultar leitura de formularios ou competir com os dados financeiros.
- Telas de usuario nao devem expor nomes de infraestrutura, chaves, variaveis de ambiente, provedores internos, modo tecnico ou detalhes de arquitetura.
- Quando uma capacidade tecnica precisar ser comunicada, usar linguagem de produto, como "MAYA ativa", "backup disponivel" ou "conexoes futuras".
- Nao criar componentes visuais novos se um componente existente atende ao caso.
- Toda decisao visual relevante deve atualizar `docs/DESIGN_SYSTEM.md`.

## 8. Regras para uso da OpenAI e IA

Qualquer recurso de IA deve ser implementado de forma isolada, auditavel e segura.

Regras obrigatorias:

- Nunca expor chaves de API no frontend, repositorio, logs ou mensagens de erro.
- Centralizar chamadas de IA em um modulo ou servico dedicado.
- Separar prompt, parametros, modelo e politica de seguranca do restante da regra de negocio.
- Registrar metadados operacionais sem armazenar conteudo sensivel desnecessario.
- Usar limites de custo, rate limiting e timeouts.
- Implementar fallback ou degradacao controlada quando a IA falhar.
- Validar e sanitizar entradas do usuario antes de envia-las a modelos.
- Validar saidas do modelo antes de usa-las em decisoes, banco de dados ou acoes automatizadas.
- Evitar que IA tome decisoes irreversiveis sem confirmacao humana quando houver risco.
- Documentar prompts, objetivos, entradas, saidas e riscos em `docs/IA_GUIDELINES.md`.

## 9. Boas praticas de seguranca

Seguranca deve ser requisito de arquitetura, nao etapa posterior.

Regras obrigatorias:

- Segredos sempre em variaveis de ambiente, vault ou secret manager.
- Senhas devem ser armazenadas apenas com hash forte e salt.
- Autorizacao deve ser checada no backend, nunca apenas na UI.
- Entradas externas devem ser validadas.
- Respostas de erro nao devem vazar stack trace, SQL, tokens ou dados sensiveis.
- Implementar protecoes contra injecao, XSS, CSRF, SSRF e abuso de upload quando aplicavel.
- Dados sensiveis devem ser minimizados, mascarados e protegidos.
- Mudancas de permissao, autenticacao, pagamento ou dados sensiveis exigem revisao extra.
- Incidentes e vulnerabilidades devem seguir `docs/SECURITY.md`.

## 10. Padroes de banco de dados

O banco deve preservar integridade e evoluir com migracoes versionadas.

Diretrizes:

- Preferir banco relacional como base inicial para dados transacionais.
- Toda tabela deve ter chave primaria, timestamps e convencoes consistentes.
- Relacionamentos importantes devem usar constraints.
- Nomes de tabelas e colunas devem ser claros e consistentes.
- Alteracoes de schema devem passar por migracoes.
- Soft delete deve ser usado apenas quando houver necessidade real de recuperacao, auditoria ou retencao.
- Dados sensiveis devem ser classificados e protegidos.
- Consultas devem ser pensadas para performance e paginacao desde cedo.
- Mudancas de dados devem atualizar `docs/DATABASE.md`.

## 11. Criterios de qualidade

Uma entrega so e considerada pronta quando:

- Cumpre o comportamento solicitado.
- Mantem a arquitetura coerente.
- Atualiza documentacao afetada.
- Inclui testes proporcionais ao risco.
- Trata estados de erro e bordas relevantes.
- Nao introduz segredos, dados sensiveis ou acoplamento desnecessario.
- Foi validada localmente quando possivel.
- Possui Implementation Report.

## 12. Padroes de testes

Testes devem proteger comportamento, nao apenas linhas de codigo.

Diretrizes:

- Testes unitarios para regras de negocio e funcoes puras.
- Testes de integracao para banco, APIs e servicos internos.
- Testes end-to-end para fluxos criticos do usuario.
- Testes de contrato para APIs consumidas por frontend ou terceiros.
- Mocks devem ser usados com criterio, sem esconder integracoes importantes.
- Bugs corrigidos devem receber teste de regressao quando viavel.
- Recursos de IA devem ter testes para validacao de entrada, parsing de saida, fallback e limites.

## 13. Estrategia de logs e observabilidade

Logs devem ajudar diagnostico sem comprometer privacidade.

Regras:

- Usar logs estruturados quando a stack permitir.
- Incluir correlation/request id em fluxos de backend.
- Nunca logar senhas, tokens, chaves, documentos pessoais ou prompts sensiveis sem mascaramento.
- Separar logs tecnicos de auditoria de negocio.
- Registrar falhas externas com provedor, operacao, status e contexto seguro.
- Medir latencia, taxa de erro e uso de recursos em operacoes criticas.

## 14. Estrategia de versionamento

- Usar versionamento semantico quando houver releases formais.
- Registrar mudancas relevantes em `docs/CHANGELOG.md`.
- APIs publicas devem ser versionadas ou ter politica explicita de compatibilidade.
- Mudancas breaking devem ser documentadas antes de implementadas.
- Nomes de branches, commits e PRs devem comunicar intencao.

## 15. Regras de escalabilidade

Escalabilidade deve ser considerada sem criar complexidade prematura.

Diretrizes:

- Projetar modulos com fronteiras claras.
- Prever paginacao e filtros em listagens.
- Evitar operacoes sincronas longas em requisicoes interativas.
- Usar filas para processamento demorado quando necessario.
- Planejar cache apenas para gargalos reais e com invalidacao clara.
- Medir antes de otimizar.
- Separar workloads criticos de tarefas em background quando a escala exigir.

## 16. Criterios para criacao de componentes

Criar um novo componente somente quando:

- Houver reutilizacao real ou complexidade local suficiente.
- O componente possuir responsabilidade clara.
- Os estados visuais e interativos forem definidos.
- A API do componente for pequena e compreensivel.
- Acessibilidade estiver contemplada.
- O componente estiver alinhado ao design system.

Nao criar componentes genericos demais antes de haver repeticao comprovada.

## 17. Criterios para criacao de APIs

Uma API deve ser criada ou alterada somente quando:

- O recurso e o caso de uso estiverem claros.
- Entrada, saida, erros e permissoes estiverem definidos.
- Houver validacao de dados.
- Houver estrategia para paginacao, ordenacao e filtros quando aplicavel.
- O endpoint nao exponha detalhes internos desnecessarios.
- A mudanca estiver documentada em `docs/API.md`.

## 18. Regras para documentacao

- `docs/PROJECT_RULES.md` prevalece em caso de conflito.
- Toda documentacao deve ser atualizada junto da mudanca que a afeta.
- Documentos devem explicar o estado atual e, quando util, o racional.
- Evitar documentacao aspiracional que contradiga o codigo.
- Registrar decisoes pendentes como pendencias explicitas.
- O `Implementation Report` de cada entrega deve listar arquivos criados, modificados, decisoes, dependencias, impactos, pendencias e proximos passos.

## 19. Ordem de precedencia

Quando houver conflito:

1. Seguranca e privacidade.
2. Regras deste documento.
3. Contratos publicos documentados.
4. Padroes de arquitetura existentes.
5. Conveniencia local de implementacao.

Nenhuma entrega deve ignorar este documento.
