-- Device/instrument API integration layer — new for the ERP-completeness
-- audit. Every ophthalmic diagnostic value (refraction, IOP, biometry) and
-- now lab results were 100% manually re-typed by staff reading an
-- instrument's own display. This gives clinic instruments (autorefractors,
-- tonometers, biometers, OCT, fundus cameras, lab analyzers — anything that
-- can make an HTTP call, not Bluetooth/IoT pairing) a defined API contract
-- to push readings into. Ingestion happens through a Supabase Edge Function
-- (device-ingest) authenticated by a per-device API key, not a staff JWT —
-- there is no other way for a non-staff caller to reach this database.
--
-- Readings land in a staging table and are auto-matched to a patient only
-- (by UHID) — never auto-matched to a specific visit or lab order, and
-- never auto-applied into a clinical record. A human always makes that
-- final call, mirroring the "don't let a workflow finish half-done"
-- posture used elsewhere in this app, just applied to "don't let a machine
-- silently write into a patient's chart" instead.

create table device_registry (
  id uuid primary key default gen_random_uuid(),
  device_name text not null,
  device_type text not null check (device_type in ('lab_analyzer', 'autorefractor', 'tonometer', 'biometer', 'oct', 'fundus_camera', 'topographer', 'other')),
  model text,
  manufacturer text,
  department text,
  api_key_hash text not null unique,
  api_key_hint text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table device_readings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references device_registry(id),
  reading_type text not null check (reading_type in ('lab_result', 'iop', 'refraction', 'biometry', 'other')),
  patient_identifier text,
  raw_payload jsonb not null,
  received_at timestamptz not null default now(),
  status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'applied', 'rejected')),
  matched_patient_id uuid references patients(id),
  matched_visit_id uuid references visits(id),
  matched_lab_order_item_id uuid references lab_order_items(id),
  applied_by uuid references profiles(id),
  applied_at timestamptz,
  notes text
);

alter table lab_order_items add constraint lab_order_items_device_reading_id_fkey foreign key (device_reading_id) references device_readings(id);

create index device_readings_device_id_idx on device_readings(device_id);
create index device_readings_status_idx on device_readings(status);
create index device_readings_matched_patient_id_idx on device_readings(matched_patient_id);

alter table device_registry enable row level security;
alter table device_readings enable row level security;

-- Device registry: biomedical_engineer already owns the equipment asset
-- register, and an interfaced instrument is still a piece of biomedical
-- equipment — lab_technician gets read-only visibility since they act on
-- the readings a lab analyzer sends.
create policy "device_registry_select" on device_registry for select to authenticated using (is_staff());
create policy "device_registry_insert" on device_registry for insert to authenticated with check (has_role('biomedical_engineer'::staff_role));
create policy "device_registry_update" on device_registry for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "device_registry_delete" on device_registry for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- Device readings: no INSERT policy for `authenticated` at all — the only
-- writer is the device-ingest Edge Function using the service-role key,
-- which bypasses RLS by design (a device is not a staff member and has no
-- profile row for has_role() to check). Reconciliation (matching a reading
-- to a patient/visit/lab-order-item and applying it) is limited to exactly
-- the roles that can write the target clinical table: optometrist/doctor
-- for iop/refraction/biometry, lab_technician for lab_result.
create policy "device_readings_select" on device_readings for select to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role, 'lab_technician'::staff_role, 'biomedical_engineer'::staff_role));
create policy "device_readings_update" on device_readings for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role, 'lab_technician'::staff_role, 'biomedical_engineer'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role, 'lab_technician'::staff_role, 'biomedical_engineer'::staff_role));

create trigger audit_device_registry after insert or update or delete on device_registry for each row execute function log_audit_event();
create trigger audit_device_readings after insert or update or delete on device_readings for each row execute function log_audit_event();
