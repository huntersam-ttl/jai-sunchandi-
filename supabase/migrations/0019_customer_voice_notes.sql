-- 0019: private customer voice notes for order, repair and feedback enquiries.
alter table public.leads drop constraint if exists leads_lead_type_check;
alter table public.leads add constraint leads_lead_type_check
 check (lead_type in ('custom_order','repair','feedback'));
alter table public.leads add column if not exists voice_note_path text not null default '';
alter table public.leads add constraint leads_voice_path_format check (
 voice_note_path = '' or voice_note_path ~ '^voices/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](webm|m4a|mp3|ogg)$'
);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('voice-notes','voice-notes',false,2097152,array['audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
 on conflict (id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
create policy "anon_insert_customer_voice" on storage.objects
 for insert to anon with check (
 bucket_id='voice-notes' and
 name ~ '^voices/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](webm|m4a|mp3|ogg)$'
);
create policy "enrolled_admin_manage_customer_voice" on storage.objects
 for all to authenticated
 using (bucket_id='voice-notes' and exists (
 select 1 from public.shop_admins where user_id=(select auth.uid())
 ))
 with check (bucket_id='voice-notes' and exists (
 select 1 from public.shop_admins where user_id=(select auth.uid())
 ));
