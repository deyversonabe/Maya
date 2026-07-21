# Auth Users Setup - Usuarios iniciais

Este guia cria os usuarios iniciais do sistema usando Supabase Auth.

## Decisao de seguranca

O sistema nao deve salvar senhas em arquivos do projeto, GitHub, Vercel ou documentacao versionada.

Os nomes `Deyveron` e `Tom` devem ser usados como nome de exibicao do usuario. O identificador tecnico do Supabase Auth continua sendo e-mail e senha.

Todos os usuarios autorizados devem ser membros do workspace financeiro compartilhado. Sem esse vinculo, o Supabase RLS impede leitura e escrita dos dados.

Cadastro publico fica desativado no app. Novos acessos devem ser criados pelo administrador no Supabase.

## Usuarios solicitados

| Nome de exibicao | E-mail de acesso | Observacao |
| --- | --- | --- |
| Deyveron | `deyversonsilvaf@gmail.com` | Conta administradora inicial e e-mail de recuperacao administrativa. |
| Tom | informe o e-mail real do Tom | Necessario para login, recuperacao e auditoria. |

## Senhas iniciais

Evite senhas de 4 digitos em producao porque o sistema guarda dados financeiros.

Recomendacao:

- Criar uma senha inicial forte para cada usuario.
- Enviar a senha fora do GitHub e fora do chat publico.
- No primeiro acesso, trocar por uma senha pessoal.

Se for indispensavel usar uma senha curta apenas como bootstrap temporario, rode o script administrativo com:

```powershell
$env:MAYA_ALLOW_WEAK_INITIAL_PASSWORDS="true"
```

Depois do primeiro acesso, altere para uma senha forte.

## Criacao manual pelo Supabase

1. Acesse `https://supabase.com/dashboard`.
2. Abra o projeto da MAYA.
3. Va em `Authentication > Providers`.
4. Desative cadastro publico de novos usuarios, mantendo login por e-mail/senha ativo.
5. Va em `Authentication > Users`.
6. Clique em `Add user` ou `Create user`.
7. Para Deyveron:
   - E-mail: `deyversonsilvaf@gmail.com`
   - Senha: defina uma senha inicial segura.
   - Confirme o e-mail se o painel oferecer essa opcao.
   - Em metadata, use:

```json
{
  "username": "Deyveron",
  "display_name": "Deyveron",
  "recovery_admin_email": "deyversonsilvaf@gmail.com"
}
```

8. Para Tom:
   - Use o e-mail real do Tom.
   - Defina uma senha inicial segura.
   - Em metadata, use:

```json
{
  "username": "Tom",
  "display_name": "Tom",
  "recovery_admin_email": "deyversonsilvaf@gmail.com"
}
```

9. Depois de criar os usuarios manualmente, inclua cada um em `finance_workspace_members` pelo SQL Editor:

```sql
insert into public.finance_workspace_members (workspace_id, user_id, role)
select
  '00000000-0000-4000-8000-000000000001',
  id,
  case when email = 'deyversonsilvaf@gmail.com' then 'admin' else 'member' end
from auth.users
where email in ('deyversonsilvaf@gmail.com', 'cole_o_email_real_do_tom')
on conflict (workspace_id, user_id) do update set role = excluded.role;
```

## Criacao por script administrativo

O script `scripts/create-supabase-auth-users.mjs` cria ou atualiza os usuarios pelo Supabase Admin API e tambem libera acesso ao workspace compartilhado.

Ele deve ser executado localmente por um administrador. Nao coloque `SUPABASE_SERVICE_ROLE_KEY` na Vercel como variavel publica.

No PowerShell:

```powershell
$env:SUPABASE_URL="cole_o_project_url_do_supabase"
$env:SUPABASE_SERVICE_ROLE_KEY="cole_a_service_role_key_do_supabase"
$env:MAYA_WORKSPACE_ID="00000000-0000-4000-8000-000000000001"
$env:MAYA_RECOVERY_ADMIN_EMAIL="deyversonsilvaf@gmail.com"

$env:MAYA_DEYVERON_EMAIL="deyversonsilvaf@gmail.com"
$env:MAYA_DEYVERON_PASSWORD="cole_a_senha_inicial_fora_do_git"

$env:MAYA_TOM_EMAIL="cole_o_email_real_do_tom"
$env:MAYA_TOM_PASSWORD="cole_a_senha_inicial_fora_do_git"

npm run auth:create-users
```

Se um usuario ja existir, o script atualiza os metadados, garante acesso ao workspace compartilhado e mantem a senha atual. Para tambem trocar a senha existente, rode antes:

```powershell
$env:MAYA_UPDATE_EXISTING_PASSWORDS="true"
```

## Recuperacao de senha pelo administrador

Antes de usar recuperacao:

1. No Supabase, abra `Authentication > URL Configuration`.
2. Configure `Site URL` com o dominio de producao, por exemplo:

```text
https://maya-steel.vercel.app
```

3. Adicione tambem os dominios finais e de desenvolvimento em `Redirect URLs`, quando existirem.
4. Abra `Authentication > Users`.
5. Selecione o usuario.
6. Use a acao de recuperacao/redefinicao de senha do painel.

O reset padrao do Supabase envia o e-mail para o e-mail do proprio usuario. Para o administrador receber instrucoes, a conta administradora deve usar `deyversonsilvaf@gmail.com`; para outros usuarios, o administrador pode gerar o reset pelo painel e orientar o usuario fora do sistema.

## O que trocar no app

Depois de criar os usuarios:

1. Suba os arquivos alterados no GitHub.
2. Faca redeploy na Vercel.
3. Abra `Dados > Conta e sincronizacao`.
4. Entre com o e-mail e senha criados no Supabase.
5. Entre com qualquer usuario autorizado para ver a mesma base financeira compartilhada.
6. Ao fechar a aba ou ficar sem uso pelo tempo configurado, o app pedira senha novamente.
