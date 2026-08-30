-- ═══════════════════════════════════════════════════════════════════════════
-- CompareBike — 0004_storage.sql
-- Storage buckets + policies.
-- Public image buckets are world-readable but owner/admin-writable by path.
-- The `private-documents` bucket is PRIVATE: owner + admin only.
-- Run after 0003.
-- ═══════════════════════════════════════════════════════════════════════════

-- Buckets (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bike-images',      'bike-images',      true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('used-bike-images', 'used-bike-images', true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('brand-images',     'brand-images',     true,  2097152,  array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('dealer-images',    'dealer-images',    true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('site-assets',      'site-assets',      true,  2097152,  array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('article-images',   'article-images',   true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('private-documents','private-documents',false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- ─── public image buckets ─────────────────────────────────────────────────
-- Anyone can read; uploads only by the path owner or an admin.

-- bike-images: admin-managed (models are admin content)
drop policy if exists "bike_images_public_read" on storage.objects;
create policy "bike_images_public_read" on storage.objects for select
  using (bucket_id = 'bike-images');
drop policy if exists "bike_images_admin_write" on storage.objects;
create policy "bike_images_admin_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'bike-images' and public.is_admin());
drop policy if exists "bike_images_admin_update" on storage.objects;
create policy "bike_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'bike-images' and public.is_admin());
drop policy if exists "bike_images_admin_delete" on storage.objects;
create policy "bike_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'bike-images' and public.is_admin());

-- used-bike-images: owner of `used/<userId>/...`
drop policy if exists "used_imgs_public_read" on storage.objects;
create policy "used_imgs_public_read" on storage.objects for select
  using (bucket_id = 'used-bike-images');
drop policy if exists "used_imgs_owner_write" on storage.objects;
create policy "used_imgs_owner_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'used-bike-images'
              and (storage.foldername(name))[1] = 'used'
              and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "used_imgs_owner_update" on storage.objects;
create policy "used_imgs_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'used-bike-images'
         and (storage.foldername(name))[1] = 'used'
         and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "used_imgs_owner_delete" on storage.objects;
create policy "used_imgs_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'used-bike-images'
         and (storage.foldername(name))[1] = 'used'
         and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "used_imgs_admin_write" on storage.objects;
create policy "used_imgs_admin_write" on storage.objects for all to authenticated
  using (bucket_id = 'used-bike-images' and public.is_admin())
  with check (bucket_id = 'used-bike-images' and public.is_admin());

-- brand-images, site-assets, article-images, dealer-images: admin-managed
do $$
declare b text;
begin
  foreach b in array array['brand-images','site-assets','article-images','dealer-images']
  loop
    execute format('drop policy if exists "%s_public_read" on storage.objects', b);
    execute format('create policy "%s_public_read" on storage.objects for select using (bucket_id = %L)', b, b);
    execute format('drop policy if exists "%s_admin_write" on storage.objects', b);
    execute format('create policy "%s_admin_write" on storage.objects for insert to authenticated with check (bucket_id = %L and public.is_admin())', b, b);
    execute format('drop policy if exists "%s_admin_update" on storage.objects', b);
    execute format('create policy "%s_admin_update" on storage.objects for update to authenticated using (bucket_id = %L and public.is_admin())', b, b);
    execute format('drop policy if exists "%s_admin_delete" on storage.objects', b);
    execute format('create policy "%s_admin_delete" on storage.objects for delete to authenticated using (bucket_id = %L and public.is_admin())', b, b);
  end loop;
end;
$$;

-- ─── private-documents (RC / insurance / GST proof) ───────────────────────
-- NEVER public. Readable only by the owner (path prefix) or an admin.
-- Paths look like used/<userId>/... and dealer/<userId>/...
drop policy if exists "private_docs_read" on storage.objects;
create policy "private_docs_read" on storage.objects for select to authenticated
  using (bucket_id = 'private-documents'
         and (
           public.is_admin()
           or ((storage.foldername(name))[1] in ('used', 'dealer')
               and (storage.foldername(name))[2] = auth.uid()::text)
         ));
drop policy if exists "private_docs_insert" on storage.objects;
create policy "private_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-documents'
              and (storage.foldername(name))[1] in ('used', 'dealer')
              and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "private_docs_admin_write" on storage.objects;
create policy "private_docs_admin_write" on storage.objects for all to authenticated
  using (bucket_id = 'private-documents' and public.is_admin())
  with check (bucket_id = 'private-documents' and public.is_admin());
