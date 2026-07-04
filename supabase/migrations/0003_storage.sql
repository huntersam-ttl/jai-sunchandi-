-- =============================================================================
-- 0003_storage.sql
-- Supabase Storage buckets for product photos and bill scans.
--
-- NOTE: This file uses Supabase storage helpers that are only available
-- when run inside the Supabase dashboard SQL editor, not plain psql.
-- If you are running migrations with psql, skip this file and create
-- the buckets manually in the Supabase dashboard → Storage.
--
-- Buckets:
--   product-photos  — public (served directly via CDN URL)
--   bill-scans      — private (accessible only via signed URL / service role)
--   repair-photos   — private (intake / damage / after photos)
-- =============================================================================

-- product-photos: public bucket, 5 MB limit per file, images only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'product-photos',
    'product-photos',
    true,
    5242880,   -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- bill-scans: private bucket, 10 MB limit
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'bill-scans',
    'bill-scans',
    false,
    10485760,  -- 10 MB
    array['image/jpeg', 'image/png', 'application/pdf']
) on conflict (id) do nothing;

-- repair-photos: private bucket, 5 MB limit
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'repair-photos',
    'repair-photos',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage RLS policies
-- ---------------------------------------------------------------------------

-- product-photos: anyone can read; service_role can upload / delete
create policy "public can read product photos"
    on storage.objects for select
    using (bucket_id = 'product-photos');

create policy "service role can manage product photos"
    on storage.objects for all
    using (bucket_id = 'product-photos' and auth.role() = 'service_role')
    with check (bucket_id = 'product-photos' and auth.role() = 'service_role');

-- bill-scans: service_role only
create policy "service role can manage bill scans"
    on storage.objects for all
    using (bucket_id = 'bill-scans' and auth.role() = 'service_role')
    with check (bucket_id = 'bill-scans' and auth.role() = 'service_role');

-- repair-photos: service_role only
create policy "service role can manage repair photos"
    on storage.objects for all
    using (bucket_id = 'repair-photos' and auth.role() = 'service_role')
    with check (bucket_id = 'repair-photos' and auth.role() = 'service_role');
