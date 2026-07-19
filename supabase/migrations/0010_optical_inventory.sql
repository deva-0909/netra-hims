-- Physical eyewear catalog (frames, lens blanks, contact lens boxes) — same
-- shape as the pharmacy drugs/stock_receipts pattern.
create table eyewear_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('frame', 'lens', 'contact_lens', 'accessory')),
  brand text not null,
  model text,
  stock_qty int not null default 0,
  unit_price numeric(10,2) not null default 0,
  reorder_level int not null default 5
);

create table eyewear_stock_receipts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references eyewear_items(id) on delete cascade,
  quantity_received int not null check (quantity_received > 0),
  note text,
  received_by uuid references profiles(id),
  received_at timestamptz not null default now()
);

-- Link an order to a specific catalog item so dispensing can decrement real stock
-- (nullable — custom/one-off frames not in the catalog just skip inventory tracking).
alter table optical_orders add column frame_item_id uuid references eyewear_items(id);

alter table eyewear_items enable row level security;
create policy "eyewear_items_select" on eyewear_items for select to authenticated using (is_staff());
create policy "eyewear_items_insert" on eyewear_items for insert to authenticated with check (has_role('optical'::staff_role));
create policy "eyewear_items_update" on eyewear_items for update to authenticated using (has_role('optical'::staff_role)) with check (has_role('optical'::staff_role));
create policy "eyewear_items_delete" on eyewear_items for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table eyewear_stock_receipts enable row level security;
create policy "eyewear_stock_receipts_select" on eyewear_stock_receipts for select to authenticated using (is_staff());
create policy "eyewear_stock_receipts_insert" on eyewear_stock_receipts for insert to authenticated with check (has_role('optical'::staff_role));
create policy "eyewear_stock_receipts_delete" on eyewear_stock_receipts for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- Seed a small starter catalog so the inventory page isn't empty on first load.
insert into eyewear_items (category, brand, model, stock_qty, unit_price, reorder_level) values
('frame', 'Titan', 'Aviator Lite', 18, 2200, 5),
('frame', 'Ray-Ban', 'Classic Round', 4, 4500, 5),
('frame', 'Fastrack', 'Sport Flex', 25, 1200, 8),
('lens', 'Essilor', 'Single Vision Anti-Reflective', 40, 1800, 10),
('lens', 'Zeiss', 'Progressive Premium', 3, 6500, 5),
('contact_lens', 'Bausch & Lomb', 'Monthly Disposable', 30, 900, 10);
