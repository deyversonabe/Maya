insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maya-finance-attachments',
  'maya-finance-attachments',
  false,
  2500000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "maya_finance_attachments_select_member" on storage.objects;
drop policy if exists "maya_finance_attachments_insert_member" on storage.objects;
drop policy if exists "maya_finance_attachments_update_member" on storage.objects;
drop policy if exists "maya_finance_attachments_delete_member" on storage.objects;

create policy "maya_finance_attachments_select_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'maya-finance-attachments'
  and public.is_finance_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "maya_finance_attachments_insert_member"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'maya-finance-attachments'
  and public.is_finance_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "maya_finance_attachments_update_member"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'maya-finance-attachments'
  and public.is_finance_workspace_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'maya-finance-attachments'
  and public.is_finance_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "maya_finance_attachments_delete_member"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'maya-finance-attachments'
  and public.is_finance_workspace_member(((storage.foldername(name))[1])::uuid)
);
