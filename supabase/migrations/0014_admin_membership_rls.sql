-- Restrict direct authenticated Data API / Storage access to explicitly enrolled admins.
-- FastAPI service-role DB connection is unaffected (bypasses RLS).
-- IMPORTANT: This migration fails closed: existing admin users will lose
-- direct Data API / Storage access until enrolled. Immediately after applying,
-- use the SQL editor or service-role connection to run:
-- INSERT INTO public.shop_admins(user_id) VALUES ('YOUR-ADMIN-AUTH-UUID');
-- Replace the placeholder with the intended auth.users.id.
-- Schedule this during a maintenance window and verify admin photo access.
--
-- Do not insert arbitrary users; only trusted shop administrators.
create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.shop_admins enable row level security;
revoke all on public.shop_admins from anon, authenticated;
grant select on public.shop_admins to authenticated;
drop policy if exists "shop_admin_self_read" on public.shop_admins;
create policy "shop_admin_self_read" on public.shop_admins
  for select to authenticated using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array[
    'shop_settings','categories','collections','daily_rates','products','customers',
    'orders','order_items','payments','repair_jobs','leads','admin_tasks',
    'material_tasks','whatsapp_templates','bill_archives','expenses'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists admin_all on public.%I', t);
      execute format(
        'create policy admin_all on public.%I for all to authenticated using (exists (select 1 from public.shop_admins where user_id = (select auth.uid()))) with check (exists (select 1 from public.shop_admins where user_id = (select auth.uid())))', t
      );
    end if;
  end loop;
end $$;

drop policy if exists "admin_manage_buckets" on storage.objects;
create policy "admin_manage_buckets" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('product-photos','shop','repair-photos','lead-photos')
    and exists (select 1 from public.shop_admins where user_id = (select auth.uid()))
  )
  with check (
    bucket_id in ('product-photos','shop','repair-photos','lead-photos')
    and exists (select 1 from public.shop_admins where user_id = (select auth.uid()))
  );

drop policy if exists "admin_manage_bill_photos" on storage.objects;
create policy "admin_manage_bill_photos" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'bill-photos'
    and exists (select 1 from public.shop_admins where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'bill-photos'
    and exists (select 1 from public.shop_admins where user_id = (select auth.uid()))
  );
