-- Laboratory / Pathology module — new for the ERP-completeness audit.
-- Ophthalmology-specific diagnostics (refractions, iop_readings,
-- imaging_records) already existed, but there was no general pathology
-- module at all: no test catalog, no order/sample/result workflow, no
-- reference ranges or abnormal-value flagging. Pre-op bloodwork, diabetic
-- workup, and routine labs had nowhere to live in the system.
--
-- device_reading_id on lab_order_items is a plain uuid (no FK yet) — the
-- device-integration round adds device_readings and the FK together, so
-- this table doesn't need to change shape again when that lands.

create table lab_test_catalog (
  id uuid primary key default gen_random_uuid(),
  test_code text not null unique,
  test_name text not null,
  category text not null default 'other' check (category in ('hematology', 'biochemistry', 'microbiology', 'serology', 'urine', 'hormone', 'other')),
  specimen_type text not null default 'blood' check (specimen_type in ('blood', 'urine', 'swab', 'stool', 'csf', 'other')),
  result_type text not null default 'numeric' check (result_type in ('numeric', 'qualitative')),
  unit text,
  reference_low numeric,
  reference_high numeric,
  reference_low_male numeric,
  reference_high_male numeric,
  reference_low_female numeric,
  reference_high_female numeric,
  reference_text text,
  turnaround_hours integer,
  price numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table lab_orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  visit_id uuid references visits(id),
  ordered_by uuid references profiles(id),
  order_date timestamptz not null default now(),
  priority text not null default 'routine' check (priority in ('routine', 'urgent', 'stat')),
  status text not null default 'ordered' check (status in ('ordered', 'sample_collected', 'in_progress', 'completed', 'cancelled')),
  clinical_notes text,
  created_at timestamptz not null default now()
);

create table lab_order_items (
  id uuid primary key default gen_random_uuid(),
  lab_order_id uuid not null references lab_orders(id) on delete cascade,
  test_id uuid not null references lab_test_catalog(id),
  status text not null default 'ordered' check (status in ('ordered', 'sample_collected', 'resulted', 'verified', 'cancelled')),
  specimen_id text,
  sample_collected_at timestamptz,
  sample_collected_by uuid references profiles(id),
  result_value text,
  result_numeric numeric,
  result_flag text check (result_flag in ('normal', 'low', 'high', 'critical')),
  result_notes text,
  resulted_by uuid references profiles(id),
  resulted_at timestamptz,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  device_reading_id uuid,
  created_at timestamptz not null default now()
);

create index lab_orders_patient_id_idx on lab_orders(patient_id);
create index lab_order_items_lab_order_id_idx on lab_order_items(lab_order_id);
create index lab_order_items_test_id_idx on lab_order_items(test_id);

-- A result must exist before an item can be marked verified, and whoever
-- verified it must be recorded — mirrors the CAPA/resolution-gate pattern
-- used elsewhere in this app for "don't let a workflow finish half-done."
create or replace function enforce_lab_result_before_verify()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'verified' and old.status is distinct from new.status then
    if new.result_value is null and new.result_numeric is null then
      raise exception 'A result must be recorded before a lab item can be verified.';
    end if;
    if new.verified_by is null then
      raise exception 'verified_by must be set when verifying a lab result.';
    end if;
  end if;
  return new;
end;
$function$;

create trigger trg_enforce_lab_result_before_verify
before update on lab_order_items
for each row execute function enforce_lab_result_before_verify();

alter table lab_test_catalog enable row level security;
alter table lab_orders enable row level security;
alter table lab_order_items enable row level security;

create policy "lab_test_catalog_select" on lab_test_catalog for select to authenticated using (is_staff());
create policy "lab_test_catalog_insert" on lab_test_catalog for insert to authenticated with check (has_role('lab_technician'::staff_role));
create policy "lab_test_catalog_update" on lab_test_catalog for update to authenticated using (has_role('lab_technician'::staff_role)) with check (has_role('lab_technician'::staff_role));
create policy "lab_test_catalog_delete" on lab_test_catalog for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create policy "lab_orders_select" on lab_orders for select to authenticated using (has_role('doctor'::staff_role, 'nurse'::staff_role, 'optometrist'::staff_role, 'ot_staff'::staff_role, 'lab_technician'::staff_role, 'mrd'::staff_role, 'quality_manager'::staff_role));
create policy "lab_orders_insert" on lab_orders for insert to authenticated with check (has_role('doctor'::staff_role, 'nurse'::staff_role, 'lab_technician'::staff_role));
create policy "lab_orders_update" on lab_orders for update to authenticated using (has_role('lab_technician'::staff_role)) with check (has_role('lab_technician'::staff_role));

create policy "lab_order_items_select" on lab_order_items for select to authenticated using (has_role('doctor'::staff_role, 'nurse'::staff_role, 'optometrist'::staff_role, 'ot_staff'::staff_role, 'lab_technician'::staff_role, 'mrd'::staff_role, 'quality_manager'::staff_role));
create policy "lab_order_items_insert" on lab_order_items for insert to authenticated with check (has_role('doctor'::staff_role, 'nurse'::staff_role, 'lab_technician'::staff_role));
create policy "lab_order_items_update" on lab_order_items for update to authenticated using (has_role('lab_technician'::staff_role)) with check (has_role('lab_technician'::staff_role));

create trigger audit_lab_orders after insert or update or delete on lab_orders for each row execute function log_audit_event();
create trigger audit_lab_order_items after insert or update or delete on lab_order_items for each row execute function log_audit_event();

insert into lab_test_catalog (test_code, test_name, category, specimen_type, result_type, unit, reference_low, reference_high, reference_low_male, reference_high_male, reference_low_female, reference_high_female, turnaround_hours, price) values
  ('CBC-HB', 'Hemoglobin', 'hematology', 'blood', 'numeric', 'g/dL', null, null, 13, 17, 12, 15, 4, 200),
  ('CBC-WBC', 'Total WBC Count', 'hematology', 'blood', 'numeric', '/cumm', 4000, 11000, null, null, null, null, 4, 150),
  ('CBC-PLT', 'Platelet Count', 'hematology', 'blood', 'numeric', 'lakh/cumm', 1.5, 4.5, null, null, null, null, 4, 150),
  ('RBS', 'Random Blood Sugar', 'biochemistry', 'blood', 'numeric', 'mg/dL', 70, 140, null, null, null, null, 2, 100),
  ('FBS', 'Fasting Blood Sugar', 'biochemistry', 'blood', 'numeric', 'mg/dL', 70, 100, null, null, null, null, 8, 100),
  ('HBA1C', 'HbA1c', 'biochemistry', 'blood', 'numeric', '%', 4, 5.6, null, null, null, null, 24, 600),
  ('CREAT', 'Serum Creatinine', 'biochemistry', 'blood', 'numeric', 'mg/dL', null, null, 0.7, 1.3, 0.6, 1.1, 6, 150),
  ('UREA', 'Blood Urea', 'biochemistry', 'blood', 'numeric', 'mg/dL', 15, 40, null, null, null, null, 6, 120),
  ('URINE-RE', 'Urine Routine & Microscopy', 'urine', 'urine', 'qualitative', null, null, null, null, null, null, null, 4, 100),
  ('CULTURE', 'Culture & Sensitivity', 'microbiology', 'swab', 'qualitative', null, null, null, null, null, null, null, 72, 500);
