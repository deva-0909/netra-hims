-- Oculoplasty Clinic — closes a P2 gap from the audit report (entirely
-- missing module). Eyelid/orbit/lacrimal exam findings had nowhere to
-- go before. Surgical planning and execution reuse the existing
-- surgery_recommendation / admission-OT shared stages rather than a
-- separate custom workflow — SURGERY_PROCEDURES (app-side) already
-- covers the relevant procedure names.

create table oculoplasty_exams (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  eyelid_position_od text check (eyelid_position_od in ('normal', 'ptosis', 'entropion', 'ectropion', 'lid_retraction', 'lagophthalmos')),
  eyelid_position_os text check (eyelid_position_os in ('normal', 'ptosis', 'entropion', 'ectropion', 'lid_retraction', 'lagophthalmos')),
  mrd1_od numeric(4,1),
  mrd1_os numeric(4,1),
  levator_function_od numeric(4,1),
  levator_function_os numeric(4,1),
  lacrimal_findings text,
  orbital_findings text,
  lesion_description text,
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index oculoplasty_exams_visit_id_idx on oculoplasty_exams(visit_id);

alter table oculoplasty_exams enable row level security;

-- Mirrors corneal_topography/dry_eye_assessments exactly (doctor + optometrist).
create policy "oculoplasty_exams_select" on oculoplasty_exams for select to authenticated using (is_staff());
create policy "oculoplasty_exams_insert" on oculoplasty_exams for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "oculoplasty_exams_update" on oculoplasty_exams for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role));
create policy "oculoplasty_exams_delete" on oculoplasty_exams for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_oculoplasty_exams after insert or update or delete on oculoplasty_exams for each row execute function log_audit_event();

insert into consultation_fees (clinic_module, fee) values ('oculoplasty', 700);
