-- Canonical fulfilment vocabulary and secure collection state.
-- This is additive and migrates only values introduced by 0015.
alter table orders add column if not exists fulfilment_country text not null default 'NP';
update leads set fulfilment_method = case fulfilment_method
  when 'shop_pickup' then 'self_collect'
  when 'courier' then 'local_delivery'
  else fulfilment_method end;
update orders set fulfilment_method = case fulfilment_method
  when 'shop_pickup' then 'self_collect'
  when 'courier' then 'local_delivery'
  else fulfilment_method end;
update leads set country = case upper(trim(country))
  when '' then 'NP' when 'NEPAL' then 'NP' when 'UNITED KINGDOM' then 'GB' when 'AUSTRALIA' then 'AU'
  else upper(trim(country)) end;
update orders set fulfilment_country = case upper(trim(fulfilment_country))
  when '' then 'NP' when 'NEPAL' then 'NP' when 'UNITED KINGDOM' then 'GB' when 'AUSTRALIA' then 'AU'
  else upper(trim(fulfilment_country)) end;

alter table leads
  add column if not exists collector_name text not null default '',
  add column if not exists collector_phone text not null default '',
  add column if not exists collector_relationship text not null default '';

alter table orders
  add column if not exists pickup_pin_hash text,
  add column if not exists pickup_pin_issued_at timestamptz,
  add column if not exists collected_by_name text not null default '';

alter table leads drop constraint if exists leads_fulfilment_method_check;
alter table leads add constraint leads_fulfilment_method_check
  check (fulfilment_method in ('self_collect','authorised_collector','local_delivery','traveller_collect','international_shipping'));
alter table orders drop constraint if exists orders_fulfilment_method_check;
alter table orders add constraint orders_fulfilment_method_check
  check (fulfilment_method in ('self_collect','authorised_collector','local_delivery','traveller_collect','international_shipping'));
alter table leads alter column fulfilment_method set default 'self_collect';
alter table orders alter column fulfilment_method set default 'self_collect';

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('new','in_progress','making','polishing','ready','delivered','collected','cancelled'));

-- Keep public enquiry uploads private and constrain object names to the
-- server/client-generated lead prefix. Bucket MIME and 5 MB limits remain the
-- storage-layer enforcement for content type and size.
drop policy if exists "anon_upload_enquiry_photos" on storage.objects;
create policy "anon_upload_enquiry_photos" on storage.objects
  for insert to anon
  with check (
    (bucket_id = 'lead-photos' and name ~ '^leads/[A-Za-z0-9][A-Za-z0-9._/-]*\.(jpg|jpeg|png|webp)$')
    or (bucket_id = 'repair-photos' and name ~ '^repairs/[A-Za-z0-9][A-Za-z0-9._/-]*\.(jpg|jpeg|png|webp)$')
  );
