-- =====================================================================
-- 0007 — reconcile order_items schema drift + explicit line numbering
--
-- item_type, line_total, snapshot, and updated_at already exist on the live
-- database (added outside tracked migration history at some point); this
-- documents them with IF NOT EXISTS so fresh deployments match reality.
--
-- Root cause fix: line_number had a static column DEFAULT of 1, so every
-- row in a multi-row INSERT for one order collided with
-- UNIQUE (order_id, line_number). The application now assigns line_number
-- explicitly per item (1, 2, 3...), so the default is dropped to prevent any
-- other insert path from silently colliding again.
-- =====================================================================

alter table order_items add column if not exists line_number integer;
alter table order_items add column if not exists item_type text not null default 'product';
alter table order_items add column if not exists line_total numeric(12,2) not null default 0;
alter table order_items add column if not exists snapshot jsonb not null default '{}'::jsonb;
alter table order_items add column if not exists updated_at timestamptz not null default now();

-- Defensive backfill for any existing rows without a real line_number
-- (safe no-op on a database with none).
with numbered as (
  select id, row_number() over (partition by order_id order by created_at, id) as rn
  from order_items
)
update order_items oi set line_number = numbered.rn
from numbered
where oi.id = numbered.id and (oi.line_number is null or oi.line_number = 0);

alter table order_items alter column line_number set not null;
alter table order_items alter column line_number drop default;
