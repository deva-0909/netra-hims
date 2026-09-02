-- Charge master — closes a billing gap from the audit report (section
-- 4.9, Billing & Revenue Cycle). Bill line items were always typed by
-- hand from a plain free-text list (BILLING_LINE_ITEMS) with no
-- standard price attached, so every bill re-priced the same service
-- from scratch. This adds a real priced service list the billing UI can
-- pull standard prices from, without removing free-text entry.

create table charge_master (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  category text not null default 'other' check (category in ('consultation', 'investigation', 'pharmacy', 'optical', 'surgery', 'admission', 'other')),
  standard_price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table charge_master enable row level security;

create policy "charge_master_select" on charge_master for select to authenticated using (is_staff());
create policy "charge_master_insert" on charge_master for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "charge_master_update" on charge_master for update to authenticated using (has_role(variadic array[]::staff_role[])) with check (has_role(variadic array[]::staff_role[]));
create policy "charge_master_delete" on charge_master for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_charge_master after insert or update or delete on charge_master for each row execute function log_audit_event();
