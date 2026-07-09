-- The bill-photos bucket (0011) was created with no file_size_limit/
-- allowed_mime_types, unlike the identical lead-photos/repair-photos private
-- photo buckets which cap at 5MB / jpeg,png,webp. Align it so an oversized or
-- unsupported upload fails fast with a clear Supabase error instead of
-- uploading unbounded data.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'bill-photos';
