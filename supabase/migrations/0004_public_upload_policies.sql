-- =====================================================================
-- 0004 — allow public (anon) uploads to the private enquiry buckets
--
-- The public custom-order / repair forms upload photos as the anon role. anon
-- may INSERT into the private lead-photos / repair-photos buckets ONLY — there
-- is no anon SELECT policy, so uploaded objects remain unreadable to the public
-- (the admin reads them via signed URLs). Public buckets (product-photos, shop)
-- are unaffected; writes there remain admin-only.
--
-- Size + MIME limits are applied to all image buckets as abuse mitigation.
-- =====================================================================

create policy "anon_upload_enquiry_photos" on storage.objects
  for insert to anon
  with check (bucket_id in ('lead-photos', 'repair-photos'));

update storage.buckets
  set file_size_limit = 5242880,  -- 5 MB
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id in ('product-photos', 'shop', 'repair-photos', 'lead-photos');
