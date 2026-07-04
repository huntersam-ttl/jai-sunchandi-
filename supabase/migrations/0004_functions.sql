-- =============================================================================
-- 0004_functions.sql
-- PostgreSQL helper functions called by the Python repository layer.
-- =============================================================================

-- increment_counter(counter_name text) → bigint
-- Atomically increments counters.seq and returns the new value.
-- Used by repositories to generate sequential human-readable numbers
-- (ORD-0001, REP-0001, CERT-2026-0001, JSD-P-0001).
create or replace function increment_counter(counter_name text)
returns bigint
language plpgsql
security definer   -- runs as owner, bypasses RLS on counters table
as $$
declare
    new_seq bigint;
begin
    update counters
       set seq = seq + 1
     where name = counter_name
    returning seq into new_seq;

    if new_seq is null then
        raise exception 'Unknown counter: %', counter_name;
    end if;

    return new_seq;
end;
$$;
