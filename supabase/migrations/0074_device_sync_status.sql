-- Device connection/last-sync status + a retry queue for failed
-- submissions — closes a gap from the audit report (section on Medical
-- Equipment Integration). Until now a device_readings row only ever
-- appeared on success; a device sending a malformed payload, or one
-- whose insert failed, left no trace anywhere for staff to see and
-- retry. Deliberately NOT logging invalid-API-key attempts here — that
-- would give an unauthenticated caller a write path into this table
-- (anyone can POST a wrong key), so failure logging only starts once a
-- device has authenticated successfully.

alter table device_registry add column last_seen_at timestamptz;
alter table device_registry add column last_reading_at timestamptz;

create table device_ingest_failures (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references device_registry(id) on delete cascade,
  reading_type text,
  error_message text not null,
  raw_body jsonb,
  occurred_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz
);

create index device_ingest_failures_device_id_idx on device_ingest_failures(device_id);

alter table device_ingest_failures enable row level security;

create policy "device_ingest_failures_select" on device_ingest_failures for select to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role, 'lab_technician'::staff_role, 'biomedical_engineer'::staff_role));
create policy "device_ingest_failures_insert" on device_ingest_failures for insert to authenticated with check (has_role(variadic array[]::staff_role[]));
create policy "device_ingest_failures_update" on device_ingest_failures for update to authenticated using (has_role('biomedical_engineer'::staff_role)) with check (has_role('biomedical_engineer'::staff_role));
create policy "device_ingest_failures_delete" on device_ingest_failures for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_device_ingest_failures after insert or update or delete on device_ingest_failures for each row execute function log_audit_event();
