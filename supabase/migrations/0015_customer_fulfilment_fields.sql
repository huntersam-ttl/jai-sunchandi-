-- Customer-experience fields are additive and preserve all existing records.
alter table leads
  add column if not exists photo_urls text[] not null default '{}',
  add column if not exists purity text not null default '',
  add column if not exists size text not null default '',
  add column if not exists country text not null default '',
  add column if not exists fulfilment_method text not null default 'shop_pickup';

alter table leads drop constraint if exists leads_fulfilment_method_check;
alter table leads add constraint leads_fulfilment_method_check
  check (fulfilment_method in ('shop_pickup','courier','international_shipping'));

alter table orders
  add column if not exists fulfilment_method text not null default 'shop_pickup',
  add column if not exists collector_name text not null default '',
  add column if not exists collector_phone text not null default '',
  add column if not exists collector_relationship text not null default '',
  add column if not exists collected_at timestamptz;

alter table orders drop constraint if exists orders_fulfilment_method_check;
alter table orders add constraint orders_fulfilment_method_check
  check (fulfilment_method in ('shop_pickup','courier','international_shipping'));
