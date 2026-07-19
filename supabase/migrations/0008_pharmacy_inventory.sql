-- Track how many units of a drug each prescription line actually dispenses,
-- so we can decrement real stock instead of just marking a status flag.
alter table prescription_items add column quantity int not null default 1;

-- Lightweight audit trail of stock received into inventory (the pharmacist's
-- "order low stock items" action logs here — no external supplier integration,
-- just an auditable record of who restocked what and when).
create table stock_receipts (
  id uuid primary key default gen_random_uuid(),
  drug_id uuid not null references drugs(id) on delete cascade,
  quantity_received int not null check (quantity_received > 0),
  note text,
  received_by uuid references profiles(id),
  received_at timestamptz not null default now()
);

alter table stock_receipts enable row level security;
create policy "stock_receipts_select" on stock_receipts for select to authenticated using (is_staff());
create policy "stock_receipts_insert" on stock_receipts for insert to authenticated with check (has_role('pharmacist'::staff_role));
create policy "stock_receipts_delete" on stock_receipts for delete to authenticated using (has_role(variadic array[]::staff_role[]));
