-- Disposable rehearsal only. This mirrors read-only observations from the
-- hosted historical project between its old baseline and repository 0014.
-- It is intentionally not a production migration and must never be applied
-- to hosted Supabase.

-- The hosted project exposed broad table privileges to API roles. Recreate
-- that privilege state so 0018 proves it removes inherited dangerous grants.
grant all privileges on all tables in schema public to anon, authenticated;
grant all privileges on all sequences in schema public to anon, authenticated;
grant all privileges on table storage.buckets, storage.objects to anon, authenticated;

-- Four historical policies used auth.role() while targeting PUBLIC. They are
-- permissive alongside admin_all and therefore allow any authenticated user.
do $$
declare
  t text;
begin
  foreach t in array array['admin_tasks','material_tasks','order_items','whatsapp_templates'] loop
    execute format(
      'create policy %I on public.%I for all to public using (auth.role() = any (array[''authenticated'',''service_role''])) with check (auth.role() = any (array[''authenticated'',''service_role'']))',
      'service role only — ' || t,
      t
    );
  end loop;
end $$;
