# Database

Este documento define padroes de dados e deve ser atualizado sempre que tabelas, colecoes, entidades persistidas, migracoes ou convencoes forem alteradas.

## Estrategia inicial

A recomendacao inicial e usar PostgreSQL via Supabase para dados transacionais, por oferecer integridade, consultas consistentes e boa evolucao para SaaS.

Na entrega funcional inicial, enquanto as credenciais reais do Supabase nao existem, o aplicativo usa armazenamento local versionado no navegador. Essa decisao permite uso real imediato, mas nao substitui o banco definitivo.

Camadas de dados:

- Atual: `localStorage` com schema versionado para transacoes, metas, preferencias e historico basico.
- Proxima etapa: Prisma apontando para PostgreSQL/Supabase.
- Futuro SaaS: Supabase Auth, Row Level Security, auditoria e backups.

Outros armazenamentos podem ser adicionados por necessidade especifica:

- Cache para performance.
- Busca textual para pesquisa avancada.
- Storage de objetos para arquivos.
- Fila ou stream para processamento assincrono.
- Banco vetorial apenas quando houver caso real de busca semantica ou RAG.

## Convencoes

As convencoes finais dependem da stack, mas devem manter:

- Chaves primarias estaveis.
- Timestamps `createdAt` e `updatedAt` ou equivalentes.
- `deletedAt` apenas quando soft delete for necessario.
- Constraints para integridade.
- Indices para filtros e joins frequentes.
- Migracoes versionadas.
- Nomes consistentes e expressivos.

## Modelo SaaS previsto

Entidades provaveis:

- User.
- Organization ou Workspace.
- Membership.
- Role.
- Permission.
- AuditLog.
- Subscription ou Plan.
- UsageLimit.

## Modelo financeiro inicial

Entidades funcionais do MVP:

- Transaction: receitas, despesas, investimentos e transferencias.
- Goal: metas financeiras, viagem, reserva, patrimonio ou aposentadoria.
- Budget: orcamentos mensais por categoria.
- Category: classificacao de receitas e despesas.
- HouseholdProfile: configuracoes do casal.
- Insight: recomendacoes calculadas a partir dos dados.

Campos essenciais de Transaction:

- `id`.
- `type`.
- `description`.
- `amount`.
- `category`.
- `person`.
- `date`.
- `recurring`.
- `recurrenceGroupId`.
- `installmentGroupId`.
- `installmentNumber`.
- `installmentTotal`.
- `source`.
- `receiptImageName`.
- `notes`.

Campos essenciais de Goal:

- `id`.
- `name`.
- `type`.
- `targetAmount`.
- `currentAmount`.
- `dueDate`.
- `priority`.

Campos essenciais de Budget:

- `id`.
- `month`.
- `category`.
- `limitAmount`.
- `notes`.
- `createdAt`.

## Rascunhos vindos do WhatsApp

A integracao inicial com WhatsApp nao cria tabela nova. Sem autenticacao e vinculacao segura de telefone, o webhook apenas processa a imagem e responde com um resumo revisavel.

Quando o projeto migrar para Supabase/PostgreSQL em producao, adicionar:

- `WhatsappContact`: telefone, householdId, status de autorizacao e timestamps.
- `ReceiptDraft`: householdId, origem, descricao, valor, categoria, data, confianca, itens, status e timestamps.

Regra: `ReceiptDraft` so vira `Transaction` apos confirmacao humana dentro do app.

Essas entidades so devem ser implementadas quando a base tecnica for criada, mas o desenho das funcionalidades deve considerar esse futuro.

## Migracao local

O armazenamento local passa a usar `schemaVersion = 2`.

Regras:

- Estados antigos `schemaVersion = 1` devem migrar automaticamente.
- A migracao deve preservar transacoes, metas e perfil.
- `budgets` deve ser inicializado como lista vazia quando nao existir.
- Nenhum dado do usuario deve ser apagado durante migracao.
- Novas instalacoes devem iniciar sem transacoes, metas ou orcamentos ficticios.
- Dados demonstrativos de versoes antigas devem ser removidos durante a migracao sem remover dados manuais do usuario.

## Migracoes

Toda mudanca de schema deve:

- Ser versionada.
- Ser reversivel quando viavel.
- Incluir estrategia para dados existentes.
- Evitar locks longos em tabelas grandes.
- Ser documentada neste arquivo quando alterar o modelo conceitual.

## Dados sensiveis

- Classificar dados pessoais e sensiveis.
- Evitar armazenar conteudo desnecessario.
- Criptografar ou mascarar quando aplicavel.
- Definir retencao e descarte.
- Nunca armazenar segredos em texto puro.

## Auditoria

Acoes sensiveis devem registrar:

- Quem executou.
- Organizacao ou escopo.
- Tipo de acao.
- Entidade afetada.
- Data e hora.
- Metadados seguros.

## Pendencias

- Criar projeto Supabase.
- Definir politicas RLS.
- Configurar `DATABASE_URL`.
- Executar migracoes Prisma em PostgreSQL.
- Migrar dados locais para banco real quando autenticacao existir.
