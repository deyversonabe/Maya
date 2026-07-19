# Database

Este documento define padroes de dados e deve ser atualizado sempre que tabelas, colecoes, entidades persistidas, migracoes ou convencoes forem alteradas.

## Estrategia inicial

A recomendacao inicial e usar PostgreSQL via Supabase para dados transacionais, por oferecer integridade, consultas consistentes e boa evolucao para SaaS.

Na entrega funcional inicial, enquanto as credenciais reais do Supabase nao existem, o aplicativo usa armazenamento local versionado no navegador. Quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estao configuradas, o app habilita conta por e-mail/senha e sincronizacao online do estado financeiro.

Camadas de dados:

- Atual sem conta online: `localStorage` com schema versionado para transacoes, metas, preferencias e historico basico.
- Atual com conta online: Supabase Auth + tabela `finance_states` protegida por RLS.
- Proxima etapa: separar entidades financeiras em tabelas relacionais normalizadas.
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

## Sincronizacao online atual

A sincronizacao online atual usa uma tabela unica para preservar velocidade de entrega e reduzir risco de migracao neste MVP.

Tabela: `public.finance_states`.

Campos:

- `id`: UUID primario.
- `user_id`: usuario autenticado do Supabase, unico por conta.
- `state`: JSONB com `FinanceState` versionado.
- `created_at`: criacao do registro.
- `updated_at`: ultima atualizacao no banco.

Regras:

- RLS deve estar ativo.
- `select`, `insert`, `update` e `delete` sao permitidos somente quando `auth.uid() = user_id`.
- Ao entrar na conta, o app compara dados locais e online.
- Quando houver dados locais e online, o app combina listas por `id` para reduzir risco de perda do que ja foi cadastrado em um aparelho.
- Depois da primeira carga, cada alteracao confirmada e enviada automaticamente para o Supabase.
- Dados financeiros continuam em `localStorage` como cache local para carregamento rapido e fallback.
- `attachmentDataUrl` nao e enviado para a nuvem nesta etapa para evitar payloads grandes em JSONB; o nome do anexo e os dados extraidos sao preservados.

Arquivo SQL:

- `supabase/migrations/20260719_finance_states.sql`.

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

## Contas a pagar

A entidade conceitual `PayableBill` representa uma conta futura ou vencida que ainda nao precisa virar transacao financeira paga.

Campos essenciais de PayableBill:

- `id`.
- `title`.
- `description`.
- `amount`.
- `category`.
- `person`.
- `dueDate`.
- `paymentMethod`: boleto, Pix, cartao ou outro.
- `paymentCode`.
- `recurrence`.
- `recurrenceGroupId`.
- `installmentGroupId`.
- `installmentNumber`.
- `installmentTotal`.
- `status`: pendente, pago ou atrasado.
- `source`: manual, anexo ou importacao.
- `attachmentImageName`.
- `attachmentDataUrl`.
- `notes`.
- `paidAt`.
- `createdAt`.

Regras:

- Contas sao agrupadas pelo mes de `dueDate`.
- Contas pagas mantem historico e nao devem ser removidas automaticamente.
- Status atrasado pode ser calculado pela data atual mesmo quando o valor persistido ainda estiver como pendente.
- Anexos confirmados pelo usuario podem ficar no armazenamento local enquanto nao existir storage seguro em nuvem.
- Quando banco real existir, anexos devem migrar para storage privado com referencia no registro.

## Rascunhos de documentos financeiros

A leitura de imagem da MAYA retorna `FinancialDocumentDraft`, que pode representar despesa, renda ou conta a pagar.

Campos essenciais:

- `kind`: despesa, renda ou conta.
- `title`.
- `description`.
- `amount`.
- `category`.
- `documentDate`.
- `dueDate`.
- `entryDate`.
- `paymentMethod`.
- `paymentCode`.
- `confidence`.
- `missingFields`.
- `items`.
- `attachmentImageName`.
- `attachmentDataUrl`.

Regra: nenhum rascunho vira `Transaction` ou `PayableBill` sem confirmacao humana.

## Duplicidade

A deteccao de duplicidade nesta etapa e feita no cliente, antes de salvar no armazenamento local.

Regras para `Transaction`:

- Comparar somente renda e despesa.
- Considerar possivel duplicidade quando `type`, `date` e `amount` forem equivalentes.
- Comparar valores com tolerancia de centavos.
- Nao apagar, mesclar ou bloquear definitivamente registros duplicados.
- Exigir confirmacao explicita do usuario quando houver repeticao.

Regras para `PayableBill`:

- Considerar possivel duplicidade quando `dueDate` e `amount` forem equivalentes.
- Mostrar titulo e categoria das contas existentes antes de confirmar.
- Permitir salvar duplicidade quando for intencional.

## Migracao local

O armazenamento local passa a usar `schemaVersion = 3`.

Regras:

- Estados antigos `schemaVersion = 1` devem migrar automaticamente.
- Estados antigos `schemaVersion = 2` devem migrar automaticamente.
- A migracao deve preservar transacoes, metas, orcamentos, perfil e contas.
- `budgets` deve ser inicializado como lista vazia quando nao existir.
- `bills` deve ser inicializado como lista vazia quando nao existir.
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
- Executar `supabase/migrations/20260719_finance_states.sql` no SQL Editor do Supabase.
- Configurar `DATABASE_URL`.
- Normalizar transacoes, metas, orcamentos e contas em tabelas relacionais quando o produto passar da fase MVP.
- Migrar anexos para Supabase Storage privado.
