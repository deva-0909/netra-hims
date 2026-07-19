-- ============================================================
-- NETRA HIMS — Storage bucket for attachments (consent forms, scans, reports)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Staff can upload/read/delete files in the "attachments" bucket. Bucket is
-- public-read so generated file URLs work directly without a signed-URL
-- dance — acceptable for a demo; a real deployment with sensitive scans
-- should make this bucket private and serve via signed URLs instead.
create policy "attachments_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and is_staff());

create policy "attachments_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and is_staff());

create policy "attachments_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and is_staff());
