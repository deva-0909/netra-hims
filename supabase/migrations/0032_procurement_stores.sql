-- ============================================================
-- NETRA HIMS — Procurement, vendors & general stores (Domain G)
-- Phase 3 of the paperless-hospital roadmap. Covers everything pharmacy
-- and optical inventory don't: linen, stationery, surgical consumables,
-- PPE, cleaning supplies — plus the vendor/PO trail to reorder against.
--
-- Simplification vs. the original roadmap doc: no separate goods_receipt_notes
-- table. Receiving is "update purchase_order_items.received_quantity", which
-- the audit_log trigger on purchase_order_items already records — a parallel
-- GRN table would just be duplicating that trail.
-- ============================================================

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'general_supplies' check (category in ('equipment', 'pharmacy', 'optical', 'general_supplies', 'services', 'other')),
  contact_person text,
  phone text,
  email text,
  address text,
  gstin text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table general_stores_inventory (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null check (category in ('linen', 'stationery', 'surgical_consumable', 'ppe', 'cleaning_supplies', 'other')),
  unit text,
  stock_qty numeric(10,2) not null default 0,
  reorder_level numeric(10,2) not null default 0,
  unit_price numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_general_stores_category on general_stores_inventory(category);
create trigger trg_general_stores_updated before update on general_stores_inventory
  for each row execute function set_updated_at();

create table purchase_requisitions (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references profiles(id),
  department text,
  item_description text not null,
  quantity numeric(10,2) not null,
  unit text,
  estimated_cost numeric(12,2),
  urgency text not null default 'routine' check (urgency in ('routine', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'converted_to_po', 'cancelled')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_purchase_requisitions_updated before update on purchase_requisitions
  for each row execute function set_updated_at();

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  vendor_id uuid not null references vendors(id),
  requisition_id uuid references purchase_requisitions(id),
  order_date date not null default current_date,
  expected_delivery_date date,
  status text not null default 'draft' check (status in ('draft', 'issued', 'partially_received', 'received', 'cancelled')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_purchase_orders_vendor on purchase_orders(vendor_id);
create index idx_purchase_orders_status on purchase_orders(status);
create trigger trg_purchase_orders_updated before update on purchase_orders
  for each row execute function set_updated_at();

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  stores_item_id uuid references general_stores_inventory(id), -- optional link: receiving auto-stocks this row
  item_description text not null,
  quantity numeric(10,2) not null,
  unit text,
  unit_price numeric(12,2),
  received_quantity numeric(10,2) not null default 0
);
create index idx_purchase_order_items_po on purchase_order_items(po_id);

create table stock_issue_notes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references general_stores_inventory(id) on delete cascade,
  department text not null,
  quantity_issued numeric(10,2) not null check (quantity_issued > 0),
  issued_to uuid references profiles(id),
  issued_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_stock_issue_notes_item on stock_issue_notes(item_id);

-- ---------- RLS ----------
-- Reads stay staff-wide throughout, matching every other inventory/asset
-- table in the app. Writes are store_keeper-only, except requisitions:
-- any staff member can request stock (they're the ones who run out of it),
-- but only store_keeper can approve/reject/convert one to a PO.
alter table vendors enable row level security;
create policy "vendors_select" on vendors for select to authenticated using (is_staff());
create policy "vendors_insert" on vendors for insert to authenticated with check (has_role('store_keeper'::staff_role));
create policy "vendors_update" on vendors for update to authenticated using (has_role('store_keeper'::staff_role)) with check (has_role('store_keeper'::staff_role));
create policy "vendors_delete" on vendors for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table general_stores_inventory enable row level security;
create policy "general_stores_inventory_select" on general_stores_inventory for select to authenticated using (is_staff());
create policy "general_stores_inventory_insert" on general_stores_inventory for insert to authenticated with check (has_role('store_keeper'::staff_role));
create policy "general_stores_inventory_update" on general_stores_inventory for update to authenticated using (has_role('store_keeper'::staff_role)) with check (has_role('store_keeper'::staff_role));
create policy "general_stores_inventory_delete" on general_stores_inventory for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table purchase_requisitions enable row level security;
create policy "purchase_requisitions_select" on purchase_requisitions for select to authenticated using (is_staff());
create policy "purchase_requisitions_insert" on purchase_requisitions for insert to authenticated with check (is_staff());
create policy "purchase_requisitions_update" on purchase_requisitions for update to authenticated using (has_role('store_keeper'::staff_role)) with check (has_role('store_keeper'::staff_role));
create policy "purchase_requisitions_delete" on purchase_requisitions for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table purchase_orders enable row level security;
create policy "purchase_orders_select" on purchase_orders for select to authenticated using (is_staff());
create policy "purchase_orders_insert" on purchase_orders for insert to authenticated with check (has_role('store_keeper'::staff_role));
create policy "purchase_orders_update" on purchase_orders for update to authenticated using (has_role('store_keeper'::staff_role)) with check (has_role('store_keeper'::staff_role));
create policy "purchase_orders_delete" on purchase_orders for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table purchase_order_items enable row level security;
create policy "purchase_order_items_select" on purchase_order_items for select to authenticated using (is_staff());
create policy "purchase_order_items_insert" on purchase_order_items for insert to authenticated with check (has_role('store_keeper'::staff_role));
create policy "purchase_order_items_update" on purchase_order_items for update to authenticated using (has_role('store_keeper'::staff_role)) with check (has_role('store_keeper'::staff_role));
create policy "purchase_order_items_delete" on purchase_order_items for delete to authenticated using (has_role('store_keeper'::staff_role));

alter table stock_issue_notes enable row level security;
create policy "stock_issue_notes_select" on stock_issue_notes for select to authenticated using (is_staff());
create policy "stock_issue_notes_insert" on stock_issue_notes for insert to authenticated with check (has_role('store_keeper'::staff_role));
create policy "stock_issue_notes_update" on stock_issue_notes for update to authenticated using (has_role('store_keeper'::staff_role)) with check (has_role('store_keeper'::staff_role));
create policy "stock_issue_notes_delete" on stock_issue_notes for delete to authenticated using (has_role('store_keeper'::staff_role));

create trigger audit_purchase_orders after insert or update or delete on purchase_orders
  for each row execute function log_audit_event();
create trigger audit_purchase_order_items after insert or update or delete on purchase_order_items
  for each row execute function log_audit_event();
