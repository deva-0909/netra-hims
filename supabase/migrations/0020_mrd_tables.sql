-- ============================================================
-- Medical Records Department (MRD) -- record disclosure register,
-- Medico-Legal Case (MLC) register, both legally/audit-relevant
-- registers every real hospital maintains that were missing entirely.
-- ============================================================

create table record_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  requestor_type text not null check (requestor_type in ('patient', 'insurance', 'legal', 'referring_doctor', 'other')),
  requestor_name text,
  purpose text,
  authorized_by uuid references profiles(id),
  status text not null default 'requested' check (status in ('requested', 'approved', 'issued', 'rejected')),
  issued_at timestamptz,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table mlc_cases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  mlc_number text not null unique,
  case_type text not null check (case_type in ('road_traffic_accident', 'assault', 'burn', 'poisoning', 'suicide_attempt', 'other')),
  incident_date date,
  incident_details text,
  police_station text,
  intimation_reference text,
  status text not null default 'reported' check (status in ('reported', 'pending_police_action', 'closed')),
  reported_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table record_requests enable row level security;
create policy "record_requests_select" on record_requests for select to authenticated using (is_staff());
create policy "record_requests_insert" on record_requests for insert to authenticated with check (has_role('mrd'::staff_role));
create policy "record_requests_update" on record_requests for update to authenticated using (has_role('mrd'::staff_role)) with check (has_role('mrd'::staff_role));
create policy "record_requests_delete" on record_requests for delete to authenticated using (has_role(variadic array[]::staff_role[]));

alter table mlc_cases enable row level security;
create policy "mlc_cases_select" on mlc_cases for select to authenticated using (is_staff());
create policy "mlc_cases_insert" on mlc_cases for insert to authenticated with check (has_role('mrd'::staff_role));
create policy "mlc_cases_update" on mlc_cases for update to authenticated using (has_role('mrd'::staff_role)) with check (has_role('mrd'::staff_role));
create policy "mlc_cases_delete" on mlc_cases for delete to authenticated using (has_role(variadic array[]::staff_role[]));
