-- ============================================================
-- NETRA HIMS — Quality, incident & regulatory compliance (Domain I)
-- Phase 4 of the paperless-hospital roadmap.
--
-- incident_reports is the one exception to this app's staff-wide-read
-- convention: adverse events, near-misses and medication errors are
-- safety/HR-sensitive in a way clinical and asset data isn't, so reads
-- follow the audit_log precedent (admin/quality_manager only) instead.
-- regulatory_licenses (AERB, biomedical waste authorization, fire NOC,
-- NABH) is compliance status, not sensitive — stays staff-wide readable.
-- ============================================================

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  incident_date timestamptz not null default now(),
  incident_type text not null check (incident_type in ('adverse_event', 'near_miss', 'needle_stick', 'fall', 'medication_error', 'equipment_failure', 'other')),
  severity text not null default 'minor' check (severity in ('minor', 'moderate', 'major', 'critical')),
  department text,
  patient_id uuid references patients(id),
  description text not null,
  immediate_action_taken text,
  reported_by uuid references profiles(id),
  status text not null default 'open' check (status in ('open', 'under_review', 'closed')),
  reviewed_by uuid references profiles(id),
  review_notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_incident_reports_status on incident_reports(status);
create trigger trg_incident_reports_updated before update on incident_reports
  for each row execute function set_updated_at();

create table regulatory_licenses (
  id uuid primary key default gen_random_uuid(),
  license_type text not null check (license_type in ('aerb_laser', 'biomedical_waste_authorization', 'fire_noc', 'pollution_control', 'trade_license', 'nabh_accreditation', 'drug_license', 'other')),
  license_number text,
  issuing_authority text,
  issue_date date,
  expiry_date date not null,
  document_url text,
  status text not null default 'active' check (status in ('active', 'expired', 'renewal_pending')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_regulatory_licenses_expiry on regulatory_licenses(expiry_date);
create trigger trg_regulatory_licenses_updated before update on regulatory_licenses
  for each row execute function set_updated_at();

-- ---------- RLS ----------
alter table incident_reports enable row level security;
create policy "incident_reports_select" on incident_reports for select to authenticated using (has_role('quality_manager'::staff_role));
create policy "incident_reports_insert" on incident_reports for insert to authenticated with check (is_staff());
create policy "incident_reports_update" on incident_reports for update to authenticated using (has_role('quality_manager'::staff_role)) with check (has_role('quality_manager'::staff_role));
create policy "incident_reports_delete" on incident_reports for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table regulatory_licenses enable row level security;
create policy "regulatory_licenses_select" on regulatory_licenses for select to authenticated using (is_staff());
create policy "regulatory_licenses_insert" on regulatory_licenses for insert to authenticated with check (has_role('quality_manager'::staff_role));
create policy "regulatory_licenses_update" on regulatory_licenses for update to authenticated using (has_role('quality_manager'::staff_role)) with check (has_role('quality_manager'::staff_role));
create policy "regulatory_licenses_delete" on regulatory_licenses for delete to authenticated using (has_role('quality_manager'::staff_role));

create trigger audit_incident_reports after insert or update or delete on incident_reports
  for each row execute function log_audit_event();
create trigger audit_regulatory_licenses after insert or update or delete on regulatory_licenses
  for each row execute function log_audit_event();
