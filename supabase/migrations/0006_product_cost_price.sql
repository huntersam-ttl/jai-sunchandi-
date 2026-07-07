-- =====================================================================
-- 0006 — product cost basis (optional)
--
-- Adds an optional cost_price to products and a frozen snapshot on
-- order_items, so profit reporting (later) can use real cost data where
-- known. Nullable everywhere: unknown cost stays unknown, never defaults
-- to zero. This migration does not add any profit/loss calculation.
-- =====================================================================

alter table products add column cost_price numeric(12,2);
alter table order_items add column cost_price numeric(12,2);
