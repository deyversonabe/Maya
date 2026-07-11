# Roadmap

Este roadmap e inicial e deve ser ajustado conforme o produto for definido.

## Fase 0: Fundacao

Objetivo: criar a base documental, arquitetural e operacional.

- Documentacao viva em `docs/`.
- Regras do projeto em `PROJECT_RULES.md`.
- Definicao inicial de arquitetura, qualidade, seguranca, banco, API, design e IA.
- Preparacao para escolha de stack.

## Fase 1: Base tecnica

Objetivo: criar a estrutura executavel do projeto.

- Escolha de stack principal.
- Estrutura de pastas da aplicacao.
- Configuracao de ambiente local.
- Linter, formatter e testes.
- Pipeline basico de validacao.
- Configuracao de variaveis de ambiente.

## Fase 2: Fundamentos SaaS

Objetivo: criar os blocos essenciais de uma plataforma multiusuario.

- Usuarios.
- Organizacoes ou workspaces.
- Autenticacao.
- Autorizacao por papeis.
- Auditoria basica.
- Configuracoes por organizacao.
- Central de dados, consentimentos e revogacao de conexoes.

## Fase 3: Produto principal

Objetivo: implementar os fluxos centrais do negocio quando o dominio estiver definido.

- Mapa de funcionalidades.
- Fluxos principais.
- APIs de dominio.
- Interface de operacao.
- Testes de integracao e e2e dos fluxos criticos.

## Fase 4: IA e automacao

Objetivo: adicionar recursos de IA com seguranca, custo controlado e observabilidade.

- Servico centralizado de IA.
- Politica de prompts.
- Controle de custo e limites.
- Avaliacao de qualidade das respostas.
- Auditoria de uso.
- Evolucao do indicador de qualidade dos dados usado pela MAYA.
- Entrada de comprovantes por WhatsApp com baixo custo e sem n8n.
- Integracoes financeiras somente apos consentimento, autenticacao e requisitos regulatorios claros.

## Fase 5: Operacao e crescimento

Objetivo: preparar evolucao para SaaS comercial.

- Billing e planos.
- Metricas de produto.
- Observabilidade avancada.
- Suporte e administracao.
- Hardening de seguranca.
- Performance e escalabilidade.

## Pendencias de decisao

- Definir dominio do produto.
- Definir stack.
- Definir modelo de monetizacao.
- Definir requisitos regulatorios especificos.
- Definir estrategia real para Open Finance antes de qualquer conexao bancaria.
