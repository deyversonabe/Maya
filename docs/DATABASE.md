# Database

Este documento define padroes de dados e deve ser atualizado sempre que tabelas, colecoes, entidades persistidas, migracoes ou convencoes forem alteradas.

## Estrategia inicial

A recomendacao inicial e usar PostgreSQL via Supabase para dados transacionais, por oferecer integridade, consultas consistentes e boa evolucao para SaaS.

Na entrega funcional inicial, enquanto as credenciais reais do Supabase nao existem, o aplicativo usa armazenamento local versionado no navegador. Quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estao configuradas, o app habilita conta por e-mail/senha e sincronizacao online do estado financeiro compartilhado pelos usuarios autorizados.

Camadas de dados:

- Atual sem conta online: `localStorage` com schema versionado para transacoes, metas, preferencias e historico basico.
- Atual com conta online: Supabase Auth + workspace financeiro compartilhado protegido por RLS, membros autorizados e Storage privado para anexos.
- Atual em preparacao SaaS: tabelas relacionais normalizadas criadas para transacoes, contas, metas, anexos e push, mantendo o JSONB compartilhado como fonte operacional do MVP ate a migracao de escrita/leitura por entidade.
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

A sincronizacao online atual usa um workspace financeiro compartilhado para preservar velocidade de entrega e permitir que Deyveron, Tom e outros membros autorizados vejam a mesma base em qualquer aparelho.

Tabelas:

- `public.finance_workspaces`: identifica a base compartilhada.
- `public.finance_workspace_members`: vincula usuarios autenticados ao workspace e define papel.
- `public.finance_workspace_states`: guarda o `FinanceState` compartilhado em JSONB.
- `public.finance_push_subscriptions`: salva inscricoes push por usuario/aparelho.
- `public.finance_push_deliveries`: registra alertas enviados por dia para evitar repeticao.
- `public.finance_transactions`, `public.finance_bills`, `public.finance_goals`, `public.finance_attachments`: base relacional preparada para migracao SaaS gradual.
- `storage.buckets` / `storage.objects`: bucket privado `maya-finance-attachments` para comprovantes, notas, boletos, Pix e extratos.

Campos principais de `finance_workspace_states`:

- `workspace_id`: workspace compartilhado.
- `state`: JSONB com `FinanceState` versionado.
- `updated_by`: usuario que salvou a ultima alteracao.
- `created_at`: criacao do registro.
- `updated_at`: ultima atualizacao no banco.

Regras:

- RLS deve estar ativo.
- Leitura e escrita sao permitidas somente para usuarios presentes em `finance_workspace_members`.
- O workspace padrao do MVP usa `00000000-0000-4000-8000-000000000001`.
- Ao entrar na conta, o app compara dados locais e dados compartilhados online.
- Quando houver dados locais e online, o app combina listas por `id` para reduzir risco de perda do que ja foi cadastrado em um aparelho.
- Depois da primeira carga, cada alteracao confirmada e enviada automaticamente para o Supabase pela RPC `save_finance_workspace_state_locked`.
- `save_finance_workspace_state_locked` valida membro ativo, bloqueia a linha com `SELECT ... FOR UPDATE` e mescla listas por `id` antes de gravar, evitando sobrescrita cega do JSONB em sessoes concorrentes.
- Exclusoes usam `deletedEntityIds` como tombstones sincronizados; qualquer item removido do estado local ou online fica bloqueado de voltar em merges futuros.
- O merge da RPC e o merge em tempo real do cliente preservam campos de anexo e itens lidos (`attachmentStoragePath`, `attachmentDataUrl`, `attachmentImageName`, `receiptImageName`, `documentItems` e equivalentes) quando outra sessao salva uma versao menos completa do mesmo registro.
- Escritas diretas em `finance_workspace_states` por cliente autenticado devem permanecer bloqueadas por RLS; o app deve usar a RPC segura.
- A tabela `finance_workspace_states` participa do Supabase Realtime para outros aparelhos receberem atualizacoes sem recarregar a pagina.
- Dados financeiros continuam em `localStorage` como cache local para carregamento rapido e fallback.
- Quando Supabase esta configurado e nao existe sessao autenticada, o app nao deve exibir dados financeiros locais.
- `attachmentStoragePath` deve ser usado quando o bucket privado estiver configurado.
- `attachmentDataUrl` fica como fallback temporario quando o Storage ainda nao estiver pronto.
- Imagens devem ser reduzidas antes do upload para evitar payloads grandes e custo desnecessario.
- `activityLogs` guarda ate 200 eventos recentes de acoes relevantes feitas por usuarios autorizados.
- `finance_workspace_members.status` controla bloqueio administrativo (`active` ou `blocked`).
- `finance_workspace_members.last_seen_at` registra ultimo acesso por funcao segura `touch_finance_workspace_member`.
- O unico e-mail autorizado como administrador e `deyversonsilvaf@gmail.com`; a trigger `finance_workspace_members_enforce_single_maya_admin` converte qualquer outro usuario com papel `admin` para `member`.
- Tabelas de push devem usar RLS e aceitar escrita apenas do proprio usuario membro ativo.
- Entregas push devem ser registradas antes do envio para reduzir alerta duplicado por rotina agendada.

Arquivo SQL:

- `supabase/migrations/20260719_finance_states.sql`.
- `supabase/migrations/20260719_shared_finance_workspace.sql`.
- `supabase/migrations/20260721_finance_attachments_storage.sql`.
- `supabase/migrations/20260721_admin_push_relational_foundation.sql`.
- `supabase/migrations/20260725_admin_unique_and_safe_workspace_state.sql`.
- `supabase/migrations/20260725_finance_accounts_wallets.sql`.
- `supabase/migrations/20260802_holerite_hours_state_merge.sql`.
- `supabase/migrations/20260802_online_deletion_tombstones.sql`.

## Modelo financeiro inicial

Entidades funcionais do MVP:

- Transaction: receitas, despesas, investimentos e transferencias.
- Goal: metas financeiras, viagem, reserva, patrimonio ou aposentadoria.
- Budget: orcamentos mensais por categoria.
- Category: classificacao de receitas e despesas.
- HouseholdProfile: configuracoes do casal.
- FinanceAccount: carteiras/contas internas com saldo inicial.
- TaxDocument: documentos e valores de apoio fiscal por ano e pessoa.
- LaborBenefit: FGTS, INSS, salario, ferias, 13 salario e beneficios por usuario.
- PayrollRecord: holerites e comparativo entre base oficial e remuneracao real informada.
- WorkTimeEntry: registro diario de jornada mensal, separado do saldo financeiro.
- Insight: recomendacoes calculadas a partir dos dados.

Versao atual do estado local/online:

- `schemaVersion: 6`.
- Estados antigos sao migrados automaticamente, adicionando `taxDocuments`, `laborBenefits`, `payrollRecords` e `workTimeEntries` vazios quando necessario.
- `deletedEntityIds` guarda ate 1000 IDs excluidos para impedir que dados removidos retornem da nuvem ou de outro aparelho.
- Dados fiscais, trabalhistas, holerites e horas ficam no mesmo `FinanceState` compartilhado para sincronizar entre Deyveron e Tom, mas nao entram nos saldos mensais livres.

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
- `paymentMethod`.
- `paymentRecipient`.
- `otherCategoryDescription`.
- `receiptImageName`.
- `attachmentImageName`.
- `attachmentDataUrl`.
- `attachmentStoragePath`.
- `attachmentMimeType`.
- `attachmentSize`.
- `documentItems`.
- `fiscalDocument`.
- `notes`.
- `accountId`.

Regras atuais de Transaction:

- `paymentMethod` aceita `cash`, `boleto`, `pix`, `card` ou `other`.
- `cash` representa pagamento em dinheiro e deve aparecer na interface como `Dinheiro`.
- Em renda variavel do studio, `paymentRecipient` registra a cliente ou pessoa que pagou.
- Em despesa Pix, `paymentRecipient` registra a pessoa ou empresa que recebeu o Pix.
- Renda fixa criada manualmente deve gerar somente 3 meses por padrao; renda variavel nao deve ser projetada.
- Toda renda ou despesa confirmada deve ser editavel e removivel pelo usuario autorizado.

Campos essenciais de FinanceAccount:

- `id`.
- `name`.
- `kind`.
- `owner`.
- `openingBalance`.
- `openingBalanceDate`.
- `color`.
- `createdAt`.

Regras de FinanceAccount:

- Toda base financeira possui uma carteira padrao chamada `Carteira do casal`.
- `openingBalance` representa o saldo real inicial informado pelo usuario, sem depender de banco conectado.
- Lancamentos sem `accountId` sao tratados como pertencentes a carteira padrao para compatibilidade com dados antigos.
- Dados antigos marcados como `Pessoa 1` e `Pessoa 2` sao normalizados no cliente para `Deyveron` e `Tom`.
- O saldo geral realizado e a soma do saldo inicial das carteiras mais entradas confirmadas menos debitos confirmados.
- Para saldo realizado, `Transaction` com data futura nao entra no total e `PayableBill` so entra quando estiver `paid`, usando `paidAt` quando existir ou `dueDate` como fallback.
- Para saldo previsto, `PayableBill` entra como saida do mes de `dueDate`; recorrencias e parcelas devem aparecer apenas no mes em que cada registro foi gerado.
- Projecoes de saldo apos contas nao devem descontar todos os registros futuros de uma vez; devem considerar somente contas vencidas ou realizadas conforme o contexto da tela.
- Carteiras internas nao executam pagamentos, Pix, boletos ou conexao bancaria real.

Campos essenciais de Goal:

- `id`.
- `name`.
- `type`.
- `targetAmount`.
- `currentAmount`.
- `contributions`.
- `dueDate`.
- `priority`.

Campos essenciais de GoalContribution:

- `id`.
- `amount`.
- `date`.
- `notes`.
- `createdAt`.

Campos essenciais de FinanceActivityLog:

- `id`.
- `actorEmail`.
- `action`.
- `entityType`.
- `entityLabel`.
- `details`.
- `createdAt`.

Regras de FinanceActivityLog:

- Registrar lancamentos, importacoes, remocoes, metas, orcamentos e alteracoes de contas.
- Manter no maximo 200 eventos recentes no estado compartilhado.
- Nao registrar valores sensiveis completos, tokens, chaves ou conteudo bruto de comprovantes.

Regras de GoalContribution:

- Cada novo saldo guardado em meta deve registrar valor e data.
- `currentAmount` permanece como saldo total atual para calculos rapidos de progresso.
- O historico em `contributions` explica quando o saldo foi adicionado ou ajustado.
- Dados antigos sem historico recebem uma entrada de saldo anterior quando `currentAmount` for maior que zero.

Campos essenciais de TaxDocument:

- `id`.
- `year`.
- `person`.
- `kind`.
- `title`.
- `institution`.
- `amount`.
- `documentDate`.
- `description`.
- `status`.
- `attachmentImageName`.
- `attachmentDataUrl`.
- `attachmentStoragePath`.
- `attachmentMimeType`.
- `attachmentSize`.
- `notes`.
- `createdAt`.
- `updatedAt`.

Regras de TaxDocument:

- `kind` classifica informe de rendimento, renda profissional, saude, educacao, saldo bancario, investimento, bem, imovel, veiculo, divida, dependente ou outro.
- `status` aceita `pending`, `reviewed` ou `ready`.
- Valores fiscais sao memoria para conferencia anual e exportacao; nao alteram saldo mensal, despesas ou receitas automaticamente.
- Documentos devem ser separados por pessoa sempre que houver impacto individual de imposto.
- O app nao deve embutir limites, aliquotas ou regras fiscais que possam ficar desatualizadas sem revisao.

Campos essenciais de LaborBenefit:

- `id`.
- `person`.
- `type`.
- `employer`.
- `referenceMonth`.
- `amount`.
- `availableBalance`.
- `blockedBalance`.
- `documentDate`.
- `notes`.
- `attachmentImageName`.
- `attachmentDataUrl`.
- `attachmentStoragePath`.
- `attachmentMimeType`.
- `attachmentSize`.
- `createdAt`.
- `updatedAt`.

Regras de LaborBenefit:

- `type` aceita FGTS, INSS, salario, 13 salario, ferias, beneficio ou outro.
- FGTS deve ser tratado como patrimonio vinculado/bloqueado, nao como saldo livre de carteira.
- Dados trabalhistas ajudam a memoria patrimonial e fiscal por pessoa, mas nao geram receita/despesa automaticamente.
- Anexos seguem a mesma regra de Storage privado usada por comprovantes financeiros.

Campos essenciais de PayrollRecord:

- `id`.
- `person`.
- `referenceMonth`.
- `employer`.
- `baseSalary`.
- `outsideBonus`.
- `payslipInss`.
- `payslipIrrf`.
- `payslipFgts`.
- `taxesPaidByEmployer`.
- `status`.
- `notes`.
- `attachmentImageName`.
- `attachmentDataUrl`.
- `attachmentStoragePath`.
- `attachmentMimeType`.
- `attachmentSize`.
- `createdAt`.
- `updatedAt`.

Regras de PayrollRecord:

- `referenceMonth` usa formato `YYYY-MM`.
- `baseSalary` representa o valor oficial do holerite.
- `outsideBonus` representa valor pago por fora ou bonus informado pelo usuario para conferencia interna.
- INSS, IRRF e FGTS do holerite sao opcionais, pois podem nao aparecer no documento informado.
- `taxesPaidByEmployer` registra a observacao operacional de que a empresa arca com encargos/descontos quando esse for o combinado informado pelo usuario.
- Os calculos de FGTS, ferias e 13 salario exibidos pela Maya sao estimativas de conferencia, nao parecer juridico ou fiscal.
- Holerites nao criam renda automaticamente e nao entram em saldo mensal; se o valor recebido precisar afetar o extrato, deve ser lancado tambem como renda.

Campos essenciais de WorkTimeEntry:

- `id`.
- `person`.
- `date`.
- `startTime`.
- `endTime`.
- `lunchBreakMinutes`.
- `expectedMinutes`.
- `notes`.
- `attachmentImageName`.
- `attachmentDataUrl`.
- `attachmentStoragePath`.
- `attachmentMimeType`.
- `attachmentSize`.
- `createdAt`.
- `updatedAt`.

Regras de WorkTimeEntry:

- `date` usa formato `YYYY-MM-DD`.
- `startTime` e `endTime` usam formato `HH:mm`.
- A jornada padrao e segunda a sexta, 08:00 as 18:00, com 72 minutos de almoco.
- `expectedMinutes` padrao e 528 minutos em dias uteis e 0 em finais de semana, podendo ser editado por registro.
- O saldo diario e calculado como minutos trabalhados menos minutos esperados.
- O saldo mensal soma apenas registros do mes, sem gerar debito automatico para dias uteis sem registro.
- Horas trabalhadas nao alteram receita, despesa, contas, metas, orcamentos ou saldos de carteira.
- Foto do registro de ponto deve usar os mesmos campos de anexo e Storage privado dos demais documentos.
- Leitura automatica do ponto gera rascunho revisavel; o usuario precisa salvar o dia para persistir o registro.

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
- `paymentRecipient`.
- `otherCategoryDescription`.
- `recurrence`.
- `recurrenceGroupId`.
- `installmentGroupId`.
- `installmentNumber`.
- `installmentTotal`.
- `status`: pendente, pago ou atrasado.
- `source`: manual, anexo ou importacao.
- `attachmentImageName`.
- `attachmentDataUrl`.
- `documentItems`.
- `fiscalDocument`.
- `notes`.
- `accountId`.
- `paidAt`.
- `createdAt`.

Regras:

- Contas sao agrupadas pelo mes de `dueDate`.
- Contas pagas mantem historico e nao devem ser removidas automaticamente.
- Status atrasado pode ser calculado pela data atual mesmo quando o valor persistido ainda estiver como pendente.
- Anexos confirmados pelo usuario sao salvos como imagem otimizada no estado compartilhado nesta etapa.
- Quando o volume crescer, anexos devem migrar para storage privado com referencia no registro.

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
- `paymentRecipient`.
- `otherCategoryDescription`.
- `confidence`.
- `missingFields`.
- `items`.
- `fiscalDocument`: metadados opcionais de DANFE/NF-e/NFC-e/cupom fiscal, como tipo fiscal, chave de acesso, emissor, CNPJ, numero, serie, protocolo e totais.
- `attachmentImageName`.
- `attachmentDataUrl`.

Regra: nenhum rascunho vira `Transaction` ou `PayableBill` sem confirmacao humana.

## Extratos bancarios

A leitura de extrato retorna `BankStatementDraft`, que nao e persistido diretamente. O usuario revisa as linhas e, apos confirmar, cada linha vira uma `Transaction` com `source = statement`.

Campos essenciais de `BankStatementDraft`:

- `title`.
- `periodStart`.
- `periodEnd`.
- `confidence`.
- `attachmentImageName`.
- `attachmentDataUrl`.
- `lines`.
- `missingFields`.
- `notes`.

Campos essenciais de cada linha:

- `type`: `income` ou `expense`.
- `description`.
- `amount`.
- `category`.
- `person`.
- `date`.
- `paymentMethod`.
- `paymentRecipient`.
- `otherCategoryDescription`.
- `confidence`.
- `notes`.

Regras:

- Linhas de extrato confirmadas devem manter uma copia resumida em `documentItems`, para consulta posterior dentro do app.
- A imagem otimizada do anexo pode ser mantida em `attachmentDataUrl` enquanto a fase MVP usa JSONB compartilhado.
- No futuro, anexos devem migrar para storage privado com URL assinada e referencia no registro.
- Durante a importacao, linhas de despesa podem ser conciliadas com `PayableBill` pendente quando valor for igual, data estiver proxima do vencimento e houver correspondencia forte de titulo, favorecido ou forma de pagamento.
- Quando uma linha for conciliada, a conta deve ser marcada como `paid` com `paidAt` baseado na data do extrato, e a linha nao deve virar uma nova `Transaction` para evitar duplicidade.

## Duplicidade

A deteccao de duplicidade nesta etapa e feita no cliente, antes de salvar no estado compartilhado.

Regras para `Transaction`:

- Comparar somente renda e despesa.
- Considerar possivel duplicidade quando `type`, `date` e `amount` forem equivalentes.
- Considerar suspeita quando `date` e `amount` forem equivalentes, mesmo que o tipo tenha sido classificado diferente.
- Considerar suspeita quando o mesmo tipo tiver mesmo valor em data proxima.
- Comparar valores com tolerancia de centavos.
- Nao apagar, mesclar ou bloquear definitivamente registros duplicados.
- Exigir decisao explicita do usuario para excluir o novo registro ou computar mesmo assim quando houver repeticao.
- Excecao permitida: quando uma nota de despesa tiver mesma `date` e mesmo `amount` de uma `Transaction` de despesa existente, anexar `attachment*`, `documentItems`, `fiscalDocument` e observacao ao registro existente sem alterar `amount`, `date` ou criar nova transacao.

Regras para `PayableBill`:

- Considerar possivel duplicidade quando `dueDate` e `amount` forem equivalentes.
- Mostrar titulo e categoria das contas existentes antes de confirmar.
- Permitir computar duplicidade quando for intencional.

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
