-- ============================================================
-- NETRA HIMS — IPD Phase 1: eMAR, bed transfers, discharge gate
--
-- The IPD/Ward Management module (charting + census) existed, but the
-- actual paper it needs to replace didn't: a doctor's inpatient drug
-- order + nurse administration record, a bed-transfer audit trail, and a
-- discharge that can't be stamped until the checklist is actually done.
-- ============================================================

-- Doctor's inpatient medication orders (eMAR — order side)
create table ipd_medication_orders (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admissions(id) on delete cascade,
  drug_name text not null,
  dosage text not null,
  route text not null default 'oral' check (route in ('oral','iv','im','topical','subcutaneous','other')),
  frequency text not null,
  start_date date not null default current_date,
  end_date date,
  instructions text,
  status text not null default 'active' check (status in ('active','discontinued','completed')),
  ordered_by uuid references profiles(id),
  discontinued_by uuid references profiles(id),
  discontinued_at timestamptz,
  discontinue_reason text,
  created_at timestamptz not null default now()
);

alter table ipd_medication_orders enable row level security;

create policy ipd_medication_orders_select on ipd_medication_orders for select
  using (has_role(variadic array['reception','optometrist','doctor','nurse','ot_staff','mrd','billing','insurance_desk']::staff_role[]));
create policy ipd_medication_orders_insert on ipd_medication_orders for insert
  with check (has_role(variadic array['doctor']::staff_role[]));
create policy ipd_medication_orders_update on ipd_medication_orders for update
  using (has_role(variadic array['doctor']::staff_role[])) with check (has_role(variadic array['doctor']::staff_role[]));
create policy ipd_medication_orders_delete on ipd_medication_orders for delete
  using (has_role(variadic array[]::staff_role[]));

-- Nurse's administration log (eMAR — administration side)
create table ipd_medication_administrations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references ipd_medication_orders(id) on delete cascade,
  administered_at timestamptz not null default now(),
  status text not null default 'given' check (status in ('given','withheld','refused')),
  notes text,
  administered_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table ipd_medication_administrations enable row level security;

create policy ipd_medication_administrations_select on ipd_medication_administrations for select
  using (has_role(variadic array['reception','optometrist','doctor','nurse','ot_staff','mrd','billing','insurance_desk']::staff_role[]));
create policy ipd_medication_administrations_insert on ipd_medication_administrations for insert
  with check (has_role(variadic array['nurse','ot_staff','doctor']::staff_role[]));
create policy ipd_medication_administrations_delete on ipd_medication_administrations for delete
  using (has_role(variadic array[]::staff_role[]));

-- Bed/ward transfer history — the actual bed_id change reuses admissions_update,
-- already granted to nurse/ot_staff/doctor; this table is the audit trail.
create table bed_transfers (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admissions(id) on delete cascade,
  from_bed_id uuid references beds(id),
  to_bed_id uuid not null references beds(id),
  reason text,
  transferred_by uuid references profiles(id),
  transferred_at timestamptz not null default now()
);

alter table bed_transfers enable row level security;

create policy bed_transfers_select on bed_transfers for select
  using (has_role(variadic array['reception','optometrist','doctor','nurse','ot_staff','mrd','billing','insurance_desk']::staff_role[]));
create policy bed_transfers_insert on bed_transfers for insert
  with check (has_role(variadic array['nurse','ot_staff','doctor']::staff_role[]));
create policy bed_transfers_delete on bed_transfers for delete
  using (has_role(variadic array[]::staff_role[]));

-- Discharge checklist gate — mirrors the sterilization "release requires a
-- passing BI" pattern: discharge can't be stamped until the checklist is
-- ticked, enforced at the database, not just the UI.
alter table admissions add column discharge_meds_handed_over boolean not null default false;
alter table admissions add column discharge_summary_reviewed boolean not null default false;

update admissions set discharge_meds_handed_over = true, discharge_summary_reviewed = true where discharged_at is not null;

alter table admissions add constraint admissions_discharge_requires_checklist
  check (discharged_at is null or (discharge_meds_handed_over and discharge_summary_reviewed));
