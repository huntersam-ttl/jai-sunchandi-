-- =====================================================================
-- 0018 — enforce admin membership at the privilege and policy layers
--
-- 0014 introduced shop_admins and membership predicates, but a hosted
-- historical baseline still has permissive authenticated policies and broad
-- table grants.  This migration is intentionally after 0014–0017: it is not
-- a substitute for applying those migrations in order.
--
-- Public access remains limited to the existing anon catalogue/read policies
-- and anonymous lead/repair photo inserts.  Authenticated direct access is
-- reserved for enrolled shop admins.  service_role/backend connections are
-- unaffected by these grants and RLS policies.
-- =====================================================================

-- Remove both the original allow-all policies and the historical policies
-- whose auth.role() expression accidentally allowed every authenticated user.
do $$
declare
  t text;
begin
  foreach t in array array[
    'shop_settings','categories','collections','daily_rates','products','customers',
    'orders','order_items','payments','repair_jobs','leads','admin_tasks',
    'material_tasks','whatsapp_templates','bill_archives','expenses'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists admin_all on public.%I', t);
      execute format('drop policy if exists %I on public.%I', 'service role only — ' || t, t);
      execute format(
        'create policy admin_all on public.%I for all to authenticated ' ||
        'using ((select exists (select 1 from public.shop_admins where user_id = (select auth.uid())))) ' ||
        'with check ((select exists (select 1 from public.shop_admins where user_id = (select auth.uid()))))',
        t
      );
    end if;
  end loop;
end $$;

-- Reset API table privileges.  The public views and anon policies below are
-- re-granted explicitly; no implicit TRUNCATE, REFERENCES, or TRIGGER access
-- remains for anon/authenticated.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;

grant select on public_shop_settings, public_categories, public_collections,
  public_products, public_daily_rates to anon;
grant select on public_shop_settings, public_categories, public_collections,
  public_products, public_daily_rates to authenticated;
grant select on public.shop_settings, public.categories, public.collections,
  public.daily_rates to anon;

-- Re-establish the intentional column boundary needed by the security-invoker
-- public_products view after the schema-wide privilege reset.
grant select (id, product_code, name, name_np, description, category, collection,
              metal, purity, weight_grams, status, show_price_on_website, photos,
              show_on_website, is_deleted)
  on public.products to anon;

-- Enrolled admins need normal CRUD for the application, but never schema-level
-- table privileges such as TRUNCATE, REFERENCES, or TRIGGER.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Product inserts use this sequence for the database-generated design code.
-- Sequence privileges are required for enrolled admin CRUD; table RLS still
-- rejects unenrolled users before a product row can be created.
grant usage, select, update on sequence public.product_code_seq to authenticated;

-- Anonymous customers may submit leads; RLS remains the row-level gate.
grant insert on public.leads to anon;

-- shop_admins is deliberately self-readable only.  Enrollment is performed
-- by the controlled deployment step using a privileged connection.
revoke all on public.shop_admins from anon, authenticated;
grant select on public.shop_admins to authenticated;

-- The abuse-limit table is backend-only, even though it is in public schema.
revoke all on public.public_request_limits from anon, authenticated;

-- Supabase Storage API operations need object read/write privileges; the
-- bucket/object policies above are the authorization boundary.  Metadata
-- mutation remains service-role/backend-only.
revoke all on table storage.buckets, storage.objects from anon, authenticated, public;
grant select on table storage.buckets to anon, authenticated;
grant select, insert on table storage.objects to anon;
grant select, insert, update, delete on table storage.objects to authenticated;

-- Re-state the Storage policies so the corrective migration is self-contained
-- and cannot inherit the old bucket-only admin policy semantics.
drop policy if exists "admin_manage_buckets" on storage.objects;
create policy "admin_manage_buckets" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('product-photos','shop','repair-photos','lead-photos')
    and (select exists (select 1 from public.shop_admins where user_id = (select auth.uid())))
  )
  with check (
    bucket_id in ('product-photos','shop','repair-photos','lead-photos')
    and (select exists (select 1 from public.shop_admins where user_id = (select auth.uid())))
  );

drop policy if exists "admin_manage_bill_photos" on storage.objects;
create policy "admin_manage_bill_photos" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'bill-photos'
    and (select exists (select 1 from public.shop_admins where user_id = (select auth.uid())))
  )
  with check (
    bucket_id = 'bill-photos'
    and (select exists (select 1 from public.shop_admins where user_id = (select auth.uid())))
  );

drop policy if exists "anon_upload_enquiry_photos" on storage.objects;
create policy "anon_upload_enquiry_photos" on storage.objects
  for insert to anon
  with check (
    (bucket_id = 'lead-photos' and name ~ '^leads/[A-Za-z0-9][A-Za-z0-9._/-]*\.(jpg|jpeg|png|webp)$')
    or (bucket_id = 'repair-photos' and name ~ '^repairs/[A-Za-z0-9][A-Za-z0-9._/-]*\.(jpg|jpeg|png|webp)$')
  );
