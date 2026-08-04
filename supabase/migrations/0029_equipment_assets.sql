-- ============================================================
-- NETRA HIMS — Biomedical equipment asset register (Domain C)
-- Inventory only, no maintenance/calibration schedules yet — those are
-- Phase 2, once every instrument has an asset row to attach a schedule to.
-- Reads stay staff-wide (consistent with bills/insurance_claims, which are
-- also financial but staff-readable) — writes are biomedical_engineer-only.
-- ============================================================

create table equipment_assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique, -- e.g. NH-EQ-0001
  name text not null, -- e.g. 'Phacoemulsification Machine'
  category text not null check (category in ('diagnostic', 'surgical', 'laser', 'sterilization', 'emergency', 'it', 'other')),
  department text,
  location text, -- room / ward
  manufacturer text,
  model_number text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric(12,2),
  warranty_end_date date,
  vendor_name text,
  vendor_contact text,
  criticality text not null default 'routine' check (criticality in ('life_safety', 'clinical_critical', 'routine')),
  status text not null default 'active' check (status in ('active', 'under_maintenance', 'decommissioned', 'disposed')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_equipment_assets_category on equipment_assets(category);
create index idx_equipment_assets_status on equipment_assets(status);
create trigger trg_equipment_assets_updated before update on equipment_assets
  for each row execute function set_updated_at();

create table equipment_documents (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  document_type text not null check (document_type in ('manual', 'warranty_card', 'purchase_invoice', 'calibration_certificate', 'service_report', 'other')),
  document_name text not null,
  document_url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_equipment_documents_equipment on equipment_documents(equipment_id);

create table amc_contracts (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  vendor_name text not null,
  vendor_contact text,
  contract_number text,
  contract_type text not null default 'amc' check (contract_type in ('amc', 'cmc', 'warranty_extension')), -- AMC = labour only, CMC = parts included
  start_date date not null,
  end_date date not null,
  coverage_details text,
  annual_cost numeric(12,2),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_amc_contracts_equipment on amc_contracts(equipment_id);
create index idx_amc_contracts_end_date on amc_contracts(end_date);

-- ---------- RLS ----------
alter table equipment_assets enable row level security;
create policy "equipment_assets_select" on equipment_assets for select to authenticated using (is_staff());
create policy "equipment_assets_insert" on equipment_assets for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "equipment_assets_update" on equipment_assets for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "equipment_assets_delete" on equipment_assets for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table equipment_documents enable row level security;
create policy "equipment_documents_select" on equipment_documents for select to authenticated using (is_staff());
create policy "equipment_documents_insert" on equipment_documents for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "equipment_documents_update" on equipment_documents for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "equipment_documents_delete" on equipment_documents for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

alter table amc_contracts enable row level security;
create policy "amc_contracts_select" on amc_contracts for select to authenticated using (is_staff());
create policy "amc_contracts_insert" on amc_contracts for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "amc_contracts_update" on amc_contracts for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "amc_contracts_delete" on amc_contracts for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

create trigger audit_equipment_assets after insert or update or delete on equipment_assets
  for each row execute function log_audit_event();
create trigger audit_amc_contracts after insert or update or delete on amc_contracts
  for each row execute function log_audit_event();
