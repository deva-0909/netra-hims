-- Glaucoma medication-compliance tracking — closes the last remaining
-- Glaucoma P1 gap from the audit report. Drops are prescribed through
-- the ordinary PharmacyStage like any other medication, but nothing
-- recorded whether a chronic glaucoma patient is actually using them —
-- the single biggest driver of progression in real-world practice.

create table glaucoma_medication_compliance (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  compliance_level text check (compliance_level in ('good', 'partial', 'poor', 'not_using')),
  current_medications text,
  barriers text,
  notes text,
  assessed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index glaucoma_medication_compliance_visit_id_idx on glaucoma_medication_compliance(visit_id);

alter table glaucoma_medication_compliance enable row level security;

-- Mirrors visual_field_tests/oct_rnfl_records (doctor, optometrist) plus
-- nurse, since compliance counseling for a chronic condition is commonly
-- a nursing task — matches the parent_followups compliance-tracking precedent.
create policy "glaucoma_medication_compliance_select" on glaucoma_medication_compliance for select to authenticated using (is_staff());
create policy "glaucoma_medication_compliance_insert" on glaucoma_medication_compliance for insert to authenticated with check (has_role('doctor'::staff_role, 'optometrist'::staff_role, 'nurse'::staff_role));
create policy "glaucoma_medication_compliance_update" on glaucoma_medication_compliance for update to authenticated using (has_role('doctor'::staff_role, 'optometrist'::staff_role, 'nurse'::staff_role)) with check (has_role('doctor'::staff_role, 'optometrist'::staff_role, 'nurse'::staff_role));
create policy "glaucoma_medication_compliance_delete" on glaucoma_medication_compliance for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_glaucoma_medication_compliance after insert or update or delete on glaucoma_medication_compliance for each row execute function log_audit_event();
