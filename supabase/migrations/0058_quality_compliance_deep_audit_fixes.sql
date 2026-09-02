-- Quality & Compliance deep-dive (quality_manager persona):
-- 1. Migration-drift backfill: patient_grievances' own CREATE TABLE was never
--    committed to a migration file (only a later ALTER touching it exists),
--    unlike every other table in this module. Recorded here idempotently so
--    the repo's migration history is reproducible on a fresh environment.
-- 2. CAPA (corrective and preventive action) tracking for incident_reports:
--    a critical incident could be closed with nothing recorded about why it
--    happened or what's being done about it. Add root_cause/
--    corrective_action/target_date and gate closing a critical incident on
--    root_cause + corrective_action being filled in.
-- 3. patient_grievances could be closed with no resolution_notes at all, and
--    could jump straight from open to closed skipping resolved — gate both.

create table if not exists patient_grievances (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  complainant_name text,
  complaint_type text not null default 'other' check (complaint_type in ('billing', 'waiting_time', 'staff_behavior', 'clinical_care', 'facility', 'other')),
  department text,
  description text not null,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'closed')),
  resolution_notes text,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  received_by uuid references profiles(id),
  received_at timestamptz not null default now()
);

alter table incident_reports add column if not exists root_cause text;
alter table incident_reports add column if not exists corrective_action text;
alter table incident_reports add column if not exists target_date date;

create or replace function enforce_critical_incident_capa()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'closed' and new.severity = 'critical' then
    if coalesce(trim(new.root_cause), '') = '' or coalesce(trim(new.corrective_action), '') = '' then
      raise exception 'A critical incident needs a root cause and corrective action recorded before it can be closed.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_critical_incident_capa on incident_reports;
create trigger trg_enforce_critical_incident_capa
before update on incident_reports
for each row execute function enforce_critical_incident_capa();

create or replace function enforce_grievance_resolution_gate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'closed' and old.status is distinct from new.status then
    if old.status is distinct from 'resolved' then
      raise exception 'A grievance must be marked resolved before it can be closed.';
    end if;
    if coalesce(trim(new.resolution_notes), '') = '' then
      raise exception 'Resolution notes are required before closing a grievance.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_grievance_resolution_gate on patient_grievances;
create trigger trg_enforce_grievance_resolution_gate
before update on patient_grievances
for each row execute function enforce_grievance_resolution_gate();
