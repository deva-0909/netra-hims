-- ============================================================
-- NETRA HIMS â€” Preventive maintenance & calibration engine (Domain D)
-- Phase 2 of the paperless-hospital roadmap. Attaches to the equipment
-- asset register built in 0029. This is the highest clinical-risk gap
-- identified in the audit: an un-calibrated tonometer or biometer feeds
-- wrong numbers straight into a treatment plan or IOL power calculation.
--
-- Facility/utility assets (generators, UPS, medical gas, HVAC â€” Domain E
-- in the roadmap) reuse this same engine rather than a parallel schema:
-- equipment_assets.category already accepts 'utility' as of this migration,
-- so a generator is just another asset row with its own PM schedule.
-- ============================================================

alter table equipment_assets drop constraint equipment_assets_category_check;
alter table equipment_assets add constraint equipment_assets_category_check
  check (category in ('diagnostic', 'surgical', 'laser', 'sterilization', 'emergency', 'it', 'utility', 'other'));

create table maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  schedule_type text not null check (schedule_type in ('preventive_maintenance', 'calibration', 'safety_check')),
  frequency_days int not null check (frequency_days > 0),
  last_completed_date date,
  next_due_date date not null,
  assigned_vendor text,
  notes text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maintenance_schedules_equipment on maintenance_schedules(equipment_id);
create index idx_maintenance_schedules_due on maintenance_schedules(next_due_date) where active;
create trigger trg_maintenance_schedules_updated before update on maintenance_schedules
  for each row execute function set_updated_at();

create table maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  schedule_id uuid references maintenance_schedules(id) on delete set null, -- null for ad-hoc breakdown reports
  work_type text not null check (work_type in ('preventive_maintenance', 'calibration', 'safety_check', 'breakdown_repair')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'routine' check (priority in ('routine', 'urgent', 'emergency')),
  description text, -- what's wrong / why this work order was raised
  reported_by uuid references profiles(id),
  assigned_to text, -- technician / vendor name â€” free text until Phase 3 adds a vendor register
  scheduled_date date,
  completed_date date,
  downtime_hours numeric(6,1),
  cost numeric(12,2),
  findings text, -- what was actually done, filled in on completion
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maintenance_work_orders_equipment on maintenance_work_orders(equipment_id);
create index idx_maintenance_work_orders_status on maintenance_work_orders(status);
create trigger trg_maintenance_work_orders_updated before update on maintenance_work_orders
  for each row execute function set_updated_at();

create table calibration_certificates (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment_assets(id) on delete cascade,
  work_order_id uuid references maintenance_work_orders(id) on delete set null,
  certificate_number text,
  certifying_body text,
  calibrated_on date not null,
  valid_until date,
  document_url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_calibration_certificates_equipment on calibration_certificates(equipment_id);

-- ---------- RLS ----------
-- Reads stay staff-wide, same as the rest of the equipment register.
-- Schedules (planning) and certificates (official records) are
-- biomedical_engineer-only to write. Work orders are the exception: any
-- active staff member can *report* an issue (insert), since a nurse or
-- optometrist is usually the first to notice a broken instrument â€” but
-- only biomedical_engineer can update/progress/complete one.
alter table maintenance_schedules enable row level security;
create policy "maintenance_schedules_select" on maintenance_schedules for select to authenticated using (is_staff());
create policy "maintenance_schedules_insert" on maintenance_schedules for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "maintenance_schedules_update" on maintenance_schedules for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "maintenance_schedules_delete" on maintenance_schedules for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

alter table maintenance_work_orders enable row level security;
create policy "maintenance_work_orders_select" on maintenance_work_orders for select to authenticated using (is_staff());
create policy "maintenance_work_orders_insert" on maintenance_work_orders for insert to authenticated with check (is_staff());
create policy "maintenance_work_orders_update" on maintenance_work_orders for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "maintenance_work_orders_delete" on maintenance_work_orders for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

alter table calibration_certificates enable row level security;
create policy "calibration_certificates_select" on calibration_certificates for select to authenticated using (is_staff());
create policy "calibration_certificates_insert" on calibration_certificates for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "calibration_certificates_update" on calibration_certificates for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "calibration_certificates_delete" on calibration_certificates for delete to authenticated using (has_role('biomedical_engineer'::staff_role));

create trigger audit_maintenance_work_orders after insert or update or delete on maintenance_work_orders
  for each row execute function log_audit_event();
create trigger audit_calibration_certificates after insert or update or delete on calibration_certificates
  for each row execute function log_audit_event();
