# Supabase Setup - Sincronizacao online

Este guia ativa conta online para ver os mesmos dados no celular e no desktop.

## Objetivo

Criar contas por e-mail/senha e salvar o estado financeiro online em uma base compartilhada para usuarios autorizados.

## Passo a passo

1. Acesse `https://supabase.com/dashboard`.
2. Crie um projeto.
3. Abra `Authentication > Providers`.
4. Confirme que `Email` esta ativo.
5. Desative cadastro publico pelo painel do Supabase, mantendo usuarios criados apenas por administrador.
6. Abra `SQL Editor`.
7. Copie e execute, nesta ordem, o conteudo de:

```text
supabase/migrations/20260719_finance_states.sql
supabase/migrations/20260719_shared_finance_workspace.sql
supabase/migrations/20260721_finance_attachments_storage.sql
supabase/migrations/20260721_admin_push_relational_foundation.sql
```

8. Abra `Project Settings > API`.
9. Copie:

```text
Project URL
anon public key
```

10. Na Vercel, abra `Settings > Environment Variables`.
11. Adicione:

```text
NEXT_PUBLIC_SUPABASE_URL=cole_o_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_a_anon_public_key
NEXT_PUBLIC_MAYA_WORKSPACE_ID=00000000-0000-4000-8000-000000000001
NEXT_PUBLIC_MAYA_SESSION_IDLE_MINUTES=15
NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET=maya-finance-attachments
SUPABASE_SERVICE_ROLE_KEY=cole_a_service_role_key_sem_next_public
NEXT_PUBLIC_VAPID_PUBLIC_KEY=cole_a_public_key_vapid
VAPID_PRIVATE_KEY=cole_a_private_key_vapid
VAPID_SUBJECT=mailto:seu-email-de-contato
CRON_SECRET=crie_um_codigo_longo_e_secreto
```

12. Para gerar VAPID, rode localmente:

```powershell
npm run push:generate-keys
```

13. Faca redeploy.
14. Crie os usuarios iniciais seguindo `docs/AUTH_USERS_SETUP.md`.
15. No app, entre com um usuario autorizado.
16. Use qualquer usuario autorizado para ver a mesma base no celular e no desktop.
17. Abra `/admin` com usuario admin para conferir usuarios, exportacoes e push.

## Usuarios iniciais

Para criar acessos como `Deyveron` e `Tom`, use Supabase Auth.

- `Deyveron` e `Tom` sao nomes de exibicao.
- O login tecnico continua sendo e-mail e senha.
- Cadastro publico pelo app fica desativado; usuarios devem ser criados pelo administrador.
- Os usuarios precisam existir em `finance_workspace_members` para ver a base compartilhada.
- Senhas nao devem ser salvas no GitHub, em `.env.example` ou em arquivos do projeto.
- O e-mail administrador de recuperacao inicial e `deyversonsilvaf@gmail.com`.

Guia completo:

```text
docs/AUTH_USERS_SETUP.md
```

## Como os dados sincronizam

- O app carrega os dados que ja existem no aparelho como cache local.
- Ao entrar na conta, ele busca a base compartilhada online.
- Se existirem dados nos dois lugares, ele combina listas por `id`.
- Depois disso, cada alteracao confirmada e salva online automaticamente.
- Outros aparelhos autenticados recebem a atualizacao pelo Supabase Realtime.
- Se a internet ou Supabase falhar, o app continua localmente e permite tentar sincronizar depois.
- Ao fechar a aba ou ficar sem uso por `NEXT_PUBLIC_MAYA_SESSION_IDLE_MINUTES`, o app pede senha novamente.
- Comprovantes, boletos, Pix e extratos sao enviados para o bucket privado `maya-finance-attachments` quando a migration de Storage estiver aplicada.
- Se o bucket ainda nao existir, o app preserva o anexo otimizado no estado financeiro como fallback temporario.
- O historico de atividades registra quem lancou, importou, pagou, editou ou removeu itens relevantes.
- O painel Admin usa `SUPABASE_SERVICE_ROLE_KEY` somente no servidor para listar usuarios e bloquear/reativar membros.
- Push real usa `finance_push_subscriptions`, `finance_push_deliveries`, service worker e cron diario da Vercel.

## Seguranca

- As tabelas `finance_workspaces`, `finance_workspace_members` e `finance_workspace_states` usam RLS.
- O bucket `maya-finance-attachments` usa politicas em `storage.objects` vinculadas ao mesmo workspace.
- Apenas usuarios membros do workspace conseguem ler ou alterar a base compartilhada.
- Anexos ficam privados e sao abertos no app por URLs assinadas temporarias.
- A chave `anon public key` pode ficar no frontend porque a protecao real vem das politicas RLS.
- A `service_role key` nunca deve ser colocada como variavel publica ou com prefixo `NEXT_PUBLIC_`.
- A `service_role key` pode ficar na Vercel apenas como segredo privado do servidor para o painel Admin e rotas administrativas.
- `VAPID_PRIVATE_KEY` e `CRON_SECRET` tambem devem ficar apenas como variaveis privadas.

## Limites atuais

- A sincronizacao atual salva o estado financeiro completo em JSONB.
- As tabelas relacionais ja existem para evolucao SaaS, mas o app ainda usa o JSONB compartilhado como fonte operacional principal.
- O workspace atual e unico para o MVP; SaaS futuro deve criar workspaces por casal/empresa.
- Anexos usam Supabase Storage privado quando configurado; o fallback em JSONB deve ser tratado como contingencia.
- Push real depende de suporte do navegador, instalacao/uso PWA em alguns celulares, chaves VAPID e cron ativo na Vercel.
