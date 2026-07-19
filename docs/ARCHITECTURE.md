# Architecture

Este documento descreve a arquitetura inicial do projeto e deve evoluir junto com a implementacao.

## Visao inicial

O projeto deve comecar com uma arquitetura modular, preparada para se tornar uma plataforma SaaS. A recomendacao inicial e um modular monolith com fronteiras claras de dominio, permitindo extracao futura de servicos sem reescrita completa.

## Aplicacao funcional inicial

O projeto passa a usar a stack obrigatoria definida pelo Prompt Mestre:

- Next.js com App Router.
- React.
- TypeScript estrito.
- TailwindCSS.
- Componentes no estilo shadcn/ui.
- Framer Motion.
- Prisma preparado para PostgreSQL.
- Supabase preparado como backend gerenciado.
- Vercel como plataforma de deploy.

Como ainda nao existem credenciais reais de Supabase/PostgreSQL/OpenAI no workspace, a primeira entrega funcional usa uma camada de persistencia local versionada no navegador. Isso permite que o produto seja realmente utilizavel para cadastro de transacoes, metas e simulacoes financeiras, sem bloquear a evolucao por falta de segredos.

Essa persistencia local e uma etapa intermediaria, nao a arquitetura final. A migracao para Supabase/PostgreSQL deve manter os mesmos conceitos de dominio.

Arquitetura atual:

```text
app/
  page.tsx
  layout.tsx
  dashboard/
  expenses/
  budgets/
  maya/
  goals/
  api/
    maya/
    whatsapp/
components/
  ui/
modules/
  ai/
  finance/
  whatsapp/
    components/
    data/
    lib/
lib/
  storage/
prisma/
  schema.prisma
```

Regra: funcionalidades novas devem nascer em `modules/` por dominio, nao diretamente acopladas a componentes globais.

## Objetivos arquiteturais

- Manter baixo acoplamento.
- Manter alta coesao por dominio.
- Facilitar testes.
- Permitir evolucao de funcionalidades por modulo.
- Isolar integracoes externas.
- Preparar multi-tenancy.
- Preservar seguranca, auditoria e observabilidade.

## Estilo recomendado

```text
Interface
  -> Application
    -> Domain
      -> Infrastructure via interfaces/adapters
```

Dependencias devem apontar para dentro sempre que a stack permitir. Regras de dominio nao devem depender de frameworks, banco, UI ou provedores externos.

## Modulos previstos

Modulos iniciais provaveis:

- `finance`: transacoes, receitas, despesas, cartoes, categorias e fluxo de caixa.
- `budgets`: planejamento mensal por categoria e alertas de consumo.
- `goals`: metas financeiras, viagens, reserva e patrimonio planejado.
- `travel`: planejamento de viagens e custos.
- `dashboard`: indicadores consolidados.
- `ai`: assistente MAYA, prompts, fallback local e adaptadores OpenAI.
- `users`: usuarios, perfil e autenticacao.
- `organizations`: workspaces, membros e papeis.
- `permissions`: autorizacao e politicas de acesso.
- `audit`: trilhas de auditoria.
- `billing`: planos, limites e assinaturas.
- `ai`: integracoes com IA e OpenAI.
- `notifications`: email, in-app ou outros canais.
- `whatsapp`: recebimento de notas pelo WhatsApp Cloud API e respostas curtas ao usuario.

Esses modulos ainda nao devem ser criados ate a stack ser definida, mas novas decisoes devem respeitar essas fronteiras conceituais.

## Integracoes externas

Toda integracao externa deve ser encapsulada em adaptador:

- OpenAI ou outros provedores de IA.
- Provedor de email.
- Pagamentos.
- Storage.
- Analytics.
- Autenticacao externa.
- WhatsApp Cloud API.

O dominio deve depender de contratos, nao de SDKs diretamente.

## Assistente MAYA

A MAYA e o assistente financeiro do casal. Ela deve funcionar em duas camadas:

- Camada local deterministica: calcula saude financeira, comparativos mensais, alertas, recorrencias, parcelas e proximos passos sem depender de rede.
- Camada OpenAI opcional: quando `OPENAI_API_KEY` existir no servidor/Vercel, usa modelo multimodal para conversa financeira e leitura de imagens de notas.

Regras arquiteturais:

- A chave OpenAI nunca deve ir para o frontend.
- Chamadas a IA ficam em rotas server-side dentro de `app/api/maya`.
- Toda resposta da IA deve ter fallback local.
- A leitura de nota deve retornar dados revisaveis pelo usuario antes de virar despesa.
- A leitura de documentos financeiros deve retornar rascunhos revisaveis para despesa, renda ou conta a pagar.
- Campos nao confirmados pela imagem devem ser tratados como ausentes, nao como inferencias.
- A MAYA nao deve julgar o casal; deve orientar com linguagem clara, acolhedora e objetiva.

## Contas e alertas

Contas a pagar ficam no modulo financeiro e devem ser independentes de pagamentos reais.

Diretrizes:

- O dominio de contas deve representar boletos, Pix copia e cola, recorrencias, parcelas, anexos e status.
- Alertas de vencimento devem ser calculados localmente a partir de `dueDate`.
- O status atrasado pode ser derivado em tempo de exibicao para evitar dados obsoletos.
- O app pode preparar texto de resumo, mas envio externo depende de canal configurado e autorizado.
- Pagamento, agendamento bancario e iniciacao Pix ficam fora do escopo ate existir parceiro regulado, consentimento, auditoria e seguranca adequados.

## Multi-tenancy

A arquitetura deve considerar que dados e permissoes poderao ser escopados por organizacao.

Diretrizes:

- Evitar recursos globais sem justificativa.
- Incluir `organizationId` ou equivalente em entidades que pertencem a uma organizacao.
- Validar escopo no backend.
- Planejar limites por organizacao/plano.
- Registrar auditoria com usuario e organizacao.

## Processamento assincrono

Tarefas demoradas devem migrar para processamento em background quando necessario:

- Chamadas longas de IA.
- Envio de emails em massa.
- Importacoes.
- Exportacoes.
- Processamento de arquivos.
- Processamento de mensagens e midias recebidas pelo WhatsApp.

## WhatsApp Cloud API

A integracao com WhatsApp deve ficar isolada em `modules/whatsapp` e ser consumida por `app/api/whatsapp/webhook`.

Diretrizes:

- O webhook valida o desafio da Meta por `WHATSAPP_VERIFY_TOKEN`.
- Eventos POST devem validar assinatura `x-hub-signature-256` quando `WHATSAPP_APP_SECRET` existir.
- Midias devem ser baixadas apenas no servidor usando `WHATSAPP_ACCESS_TOKEN`.
- A MAYA pode ler a imagem e montar rascunho, mas a despesa final exige confirmacao humana.
- Sem autenticacao e banco em nuvem, a resposta por WhatsApp deve orientar revisao no app em vez de gravar dados automaticamente.

## Observabilidade

Desde a base tecnica, o projeto deve prever:

- Logs estruturados.
- Request/correlation id.
- Metricas de latencia e erro.
- Auditoria para acoes sensiveis.
- Monitoramento de integracoes externas.

## Decisoes pendentes

- Credenciais e projeto Supabase.
- URL PostgreSQL real para Prisma.
- Autenticacao.
- Hospedagem.
- Pipeline de CI/CD.

Essas decisoes devem ser registradas neste documento quando forem tomadas.
