# Supabase Setup - Sincronizacao online

Este guia ativa conta online para ver os mesmos dados no celular e no desktop.

## Objetivo

Criar contas por e-mail/senha e salvar o estado financeiro online em uma base compartilhada para usuarios autorizados.

## Passo a passo

1. Acesse `https://supabase.com/dashboard`.
2. Crie um projeto.
3. Abra `Authentication > Providers`.
4. Confirme que `Email` esta ativo.
5. Abra `SQL Editor`.
6. Copie e execute, nesta ordem, o conteudo de:

```text
supabase/migrations/20260719_finance_states.sql
supabase/migrations/20260719_shared_finance_workspace.sql
```

7. Abra `Project Settings > API`.
8. Copie:

```text
Project URL
anon public key
```

9. Na Vercel, abra `Settings > Environment Variables`.
10. Adicione:

```text
NEXT_PUBLIC_SUPABASE_URL=cole_o_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_a_anon_public_key
NEXT_PUBLIC_MAYA_WORKSPACE_ID=00000000-0000-4000-8000-000000000001
NEXT_PUBLIC_MAYA_SESSION_IDLE_MINUTES=15
```

11. Faca redeploy.
12. Crie os usuarios iniciais seguindo `docs/AUTH_USERS_SETUP.md`.
13. No app, abra `Dados`.
14. Crie uma conta ou entre.
15. Use o mesmo e-mail no celular e no desktop.

## Usuarios iniciais

Para criar acessos como `Deyveron` e `Tom`, use Supabase Auth.

- `Deyveron` e `Tom` sao nomes de exibicao.
- O login tecnico continua sendo e-mail e senha.
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

## Seguranca

- As tabelas `finance_workspaces`, `finance_workspace_members` e `finance_workspace_states` usam RLS.
- Apenas usuarios membros do workspace conseguem ler ou alterar a base compartilhada.
- A chave `anon public key` pode ficar no frontend porque a protecao real vem das politicas RLS.
- A `service_role key` nunca deve ser colocada na Vercel como variavel publica.
- A `service_role key` deve ser usada apenas em operacoes administrativas locais, como o script de criacao de usuarios.

## Limites atuais

- A sincronizacao atual salva o estado financeiro completo em JSONB.
- O workspace atual e unico para o MVP; SaaS futuro deve criar workspaces por casal/empresa.
- Anexos originais em base64 nao sao enviados para a nuvem nesta etapa.
- Para salvar imagens em varios aparelhos, a proxima etapa e Supabase Storage privado.
