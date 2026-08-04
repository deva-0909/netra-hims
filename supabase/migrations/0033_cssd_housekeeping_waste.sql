-- ============================================================
-- NETRA HIMS — Sterile services, housekeeping & biomedical waste (Domain F)
-- Phase 3 of the paperless-hospital roadmap.
--
-- Sterilization cycles are logged by whoever actually runs CSSD (nurse/
-- ot_staff), same clinical roles that already log ot_records/admissions —
-- not store_keeper, who owns logistics rather than sterile processing.
-- Housekeeping and biomedical waste are store_keeper's facilities remit.
-- ============================================================

create table sterilization_cycles (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references equipment_assets(id), -- the autoclave/ETO sterilizer, if registered
  cycle_date timestamptz not null default now(),
  load_description text,
  biological_indicator_result text not null default 'pending' check (biological_indicator_result in ('pending', 'pass', 'fail')),
  performed_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_sterilization_cycles_equipment on sterilization_cycles(equipment_id);
create index idx_sterilization_cycles_date on sterilization_cycles(cycle_date);

create table biomedical_waste_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  category text not null check (category in ('yellow', 'red', 'white', 'blue')), -- BMW Rules 2016 colour categories
  quantity_kg numeric(8,2),
  collected_by uuid references profiles(id),
  handed_over_to text, -- authorized BMW vendor
  manifest_number text,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_biomedical_waste_log_date on biomedical_waste_log(log_date);

create table housekeeping_schedules (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  last_done_date date,
  next_due_date date not null,
  assigned_to text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_housekeeping_schedules_due on housekeeping_schedules(next_due_date) where active;
create trigger trg_housekeeping_schedules_updated before update on housekeeping_schedules
  for each row execute function set_updated_at();

-- ---------- RLS ----------
alter table sterilization_cycles enable row level security;
create policy "sterilization_cycles_select" on sterilization_cycles for select to authenticated using (is_staff());
create policy "sterilization_cycles_insert" on sterilization_cycles for insert to authenticated with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'store_keeper'::staff_role));
create policy "sterilization_cycles_update" on sterilization_cycles for update to authenticated using (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'store_keeper'::staff_role)) with check (has_role('nurse'::staff_role, 'ot_staff'::staff_role, 'store_keeper'::staff_role));
create policy "sterilization_cycles_delete" on sterilization_cycles for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table biomedical_waste_log enable row level security;
create policy "biomedical_waste_log_select" on biomedical_waste_log for select to authenticated using (is_staff());
create policy "biomedical_waste_log_insert" on biomedical_waste_log for insert to authenticated with check (has_role('store_keeper'::staff_role, 'nurse'::staff_role));
create policy "biomedical_waste_log_update" on biomedical_waste_log for update to authenticated using (has_role('store_keeper'::staff_role, 'nurse'::staff_role)) with check (has_role('store_keeper'::staff_role, 'nurse'::staff_role));
create policy "biomedical_waste_log_delete" on biomedical_waste_log for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table housekeeping_schedules enable row level security;
create policy "housekeeping_schedules_select" on housekeeping_schedules for select to authenticated using (is_staff());
create policy "housekeeping_schedules_insert" on housekeeping_schedules for insert to authenticated with check (has_role('store_keeper'::staff_role));
create policy "housekeeping_schedules_update" on housekeeping_schedules for update to authenticated using (has_role('store_keeper'::staff_role)) with check (has_role('store_keeper'::staff_role));
create policy "housekeeping_schedules_delete" on housekeeping_schedules for delete to authenticated using (has_role('store_keeper'::staff_role));

create trigger audit_biomedical_waste_log after insert or update or delete on biomedical_waste_log
  for each row execute function log_audit_event();
