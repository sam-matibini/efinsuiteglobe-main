
create policy "identity media read" on storage.objects for select to authenticated
  using (bucket_id = 'identity-media' and public.has_any_role(auth.uid()));
create policy "identity media insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'identity-media' and public.can_write(auth.uid()));
