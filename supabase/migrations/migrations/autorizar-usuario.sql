-- Substitua os e-mails abaixo antes de executar.
with target_workspace as (
  select id
  from public.finance_workspaces
  order by created_at nulls last
  limit 1
),
target_user as (
  select id, lower(email) as email
  from auth.users
  where lower(email) in (
    lower('deyversonsilvaf@gmail.com'),
    lower('tom@example.com')
  )
)
insert into public.finance_workspace_members (
  workspace_id,
  user_id,
  display_name,
  recovery_email,
  role,
  status
)
select
  target_workspace.id,
  target_user.id,
  case
    when target_user.email = lower('deyversonsilvaf@gmail.com') then 'Deyverson'
    else split_part(target_user.email, '@', 1)
  end,
  'deyversonsilvaf@gmail.com',
  case
    when target_user.email = lower('deyversonsilvaf@gmail.com') then 'admin'
    else 'member'
  end,
  'active'
from target_workspace
cross join target_user
on conflict (workspace_id, user_id) do update
set
  display_name = excluded.display_name,
  recovery_email = excluded.recovery_email,
  role = excluded.role,
  status = 'active';

update public.finance_workspace_members member
set role = 'member'
from auth.users auth_user
where auth_user.id = member.user_id
  and lower(auth_user.email) <> lower('deyversonsilvaf@gmail.com')
  and member.role = 'admin';
