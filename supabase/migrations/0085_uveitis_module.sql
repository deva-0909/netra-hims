-- Uveitis Clinic — closes a P2 gap from the audit report (entirely
-- missing module). Anatomical classification, SUN-grading anterior
-- chamber/vitreous inflammation, etiology workup and treatment had
-- nowhere to go before. Surgical needs (e.g. cataract surgery in a
-- uveitic eye) reuse the shared surgery_recommendation/admission-OT
-- stages like every other clinic.

create table uveitis_exams (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  anatomical_type_od text check (anatomical_type_od in ('anterior', 'intermediate', 'posterior', 'panuveitis')),
  anatomical_type_os text check (anatomical_type_os in ('anterior', 'intermediate', 'posterior', 'panuveitis')),
  etiology text,
  ac_cells_grade_od text,
  ac_cells_grade_os text,
  vitreous_haze_grade_od text,
  vitreous_haze_grade_os text,
  complications text,
  systemic_workup_notes text,
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table uveitis_treatments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  eye text check (eye in ('od', 'os', 'both')),
  treatment_type text check (treatment_type in ('topical_steroids', 'periocular_injection', 'systemic_steroids', 'immunosuppressant', 'biologic', 'observation')),
  drug_id uuid references drugs(id),
  drug_name text,
  next_review_date date,
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index uveitis_exams_visit_id_idx on uveitis_exams(visit_id);
create index uveitis_treatments_visit_id_idx on uveitis_treatments(visit_id);

alter table uveitis_exams enable row level security;
alter table uveitis_treatments enable row level security;

-- Mirrors corneal_topography/dry_eye_assessments exactly (doctor + optometrist).
create policy "uveitis_exams_select" on uveitis_exams for select to authenticated using (is_staff());
create policy "uveitis_exams_insert" on uveitis_exams for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "uveitis_exams_update" on uveitis_exams for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "uveitis_exams_delete" on uveitis_exams for delete to authenticated using (has_role(variadic array[]::staff_role[]));

-- Treatment decisions are doctor-only (mirrors retina_treatments/gonioscopy).
create policy "uveitis_treatments_select" on uveitis_treatments for select to authenticated using (is_staff());
create policy "uveitis_treatments_insert" on uveitis_treatments for insert to authenticated with check (has_role('doctor'::staff_role));
create policy "uveitis_treatments_update" on uveitis_treatments for update to authenticated using (has_role('doctor'::staff_role)) with check (has_role('doctor'::staff_role));
create policy "uveitis_treatments_delete" on uveitis_treatments for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_uveitis_exams after insert or update or delete on uveitis_exams for each row execute function log_audit_event();
create trigger audit_uveitis_treatments after insert or update or delete on uveitis_treatments for each row execute function log_audit_event();

insert into consultation_fees (clinic_module, fee) values ('uveitis', 800);
