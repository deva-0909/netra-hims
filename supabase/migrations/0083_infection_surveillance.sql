-- Infection surveillance — closes the Quality/NABH P2 gap from the audit
-- report. NABH accreditation requires ongoing surveillance and monthly
-- rate reporting of healthcare-associated infections (surgical site,
-- catheter-associated UTI, bloodstream, respiratory); nothing tracked
-- this before. Select stays staff-wide (unlike incident_reports, which
-- is deliberately narrower for HR-sensitive adverse events) since an
-- active infection is clinically relevant to the treating team, not
-- just Quality — matches regulatory_licenses' precedent, not
-- incident_reports'.

create table infection_surveillance_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  admission_id uuid references admissions(id),
  ot_record_id uuid references ot_records(id),
  infection_type text not null check (infection_type in ('surgical_site_infection', 'urinary_tract_infection', 'bloodstream_infection', 'respiratory_infection', 'other')),
  onset_date date not null default current_date,
  organism_identified text,
  severity text not null default 'mild' check (severity in ('mild', 'moderate', 'severe')),
  management text,
  outcome text not null default 'ongoing' check (outcome in ('ongoing', 'resolved', 'transferred', 'death')),
  reported_to_nabh boolean not null default false,
  notes text,
  reported_by uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  status text not null default 'open' check (status in ('open', 'under_review', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_infection_surveillance_status on infection_surveillance_records(status);
create index idx_infection_surveillance_onset on infection_surveillance_records(onset_date);

create trigger trg_infection_surveillance_updated before update on infection_surveillance_records
  for each row execute function set_updated_at();

alter table infection_surveillance_records enable row level security;

create policy "infection_surveillance_select" on infection_surveillance_records for select to authenticated using (is_staff());
create policy "infection_surveillance_insert" on infection_surveillance_records for insert to authenticated with check (has_role('doctor'::staff_role, 'nurse'::staff_role, 'quality_manager'::staff_role));
create policy "infection_surveillance_update" on infection_surveillance_records for update to authenticated using (has_role('quality_manager'::staff_role)) with check (has_role('quality_manager'::staff_role));
create policy "infection_surveillance_delete" on infection_surveillance_records for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_infection_surveillance after insert or update or delete on infection_surveillance_records for each row execute function log_audit_event();
