-- ============================================================
-- NETRA HIMS — Public appointment requests (Domain J, patient self-service)
-- Phase 5 of the paperless-hospital roadmap.
--
-- This is the one table in the whole schema writable by an unauthenticated
-- visitor: a lightweight "call me back" form on a public page, not a real
-- patient/appointment record. Reception reviews these and, if they proceed,
-- registers the patient and books the appointment through the normal
-- Patients/Appointments flow — nothing here auto-creates a patient record,
-- so a spammed request can't forge one.
-- ============================================================

create table appointment_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  preferred_clinic_module text not null check (preferred_clinic_module in ('general', 'retina', 'glaucoma', 'lasik', 'pediatric')),
  preferred_date date,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'declined')),
  staff_notes text,
  created_at timestamptz not null default now()
);
create index idx_appointment_requests_status on appointment_requests(status);

alter table appointment_requests enable row level security;
create policy "appointment_requests_insert" on appointment_requests for insert to public with check (true);
create policy "appointment_requests_select" on appointment_requests for select to authenticated using (is_staff());
create policy "appointment_requests_update" on appointment_requests for update to authenticated using (has_role('reception'::staff_role)) with check (has_role('reception'::staff_role));
create policy "appointment_requests_delete" on appointment_requests for delete to authenticated using (has_role(variadic array[]::staff_role[]));
